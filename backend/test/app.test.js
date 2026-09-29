'use strict';

const assert = require('node:assert/strict');
const { once } = require('node:events');
const { test } = require('node:test');

process.env.NODE_ENV = 'test';
const { createApp, resolvePort } = require('../app');

const sampleVolume = {
  id: 'book_123',
  volumeInfo: {
    title: 'The Great Gatsby',
    authors: ['F. Scott Fitzgerald'],
    description: 'A novel.',
    averageRating: 4.2,
    ratingsCount: 25,
    imageLinks: { thumbnail: 'http://books.example/cover.jpg' },
    industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780743273565' }],
  },
  saleInfo: { retailPrice: { amount: 12.5, currencyCode: 'USD' } },
};

async function withServer(fetchImpl, run, apiKey = 'test-key') {
  const server = createApp({ fetchImpl, apiKey }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('health route reports healthy and configured port', async () => {
  await withServer(async () => { throw new Error('provider should not be called'); }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.status, 'healthy');
    assert.equal(typeof body.timestamp, 'string');
    assert.equal(typeof body.uptime, 'number');
    assert.equal(body.port, 5000);
  });
});

test('search returns normalized Google Books results and sends the API key', async () => {
  let requestedUrl;
  const fetchImpl = async (url) => {
    requestedUrl = new URL(url);
    return jsonResponse({ totalItems: 1, items: [sampleVolume] });
  };

  await withServer(fetchImpl, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/books/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'The Great Gatsby', type: 'title' }),
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(requestedUrl.searchParams.get('q'), 'intitle:The Great Gatsby');
    assert.equal(requestedUrl.searchParams.get('key'), 'test-key');
    assert.equal(body.data.totalItems, 1);
    assert.equal(body.data.books[0].title, 'The Great Gatsby');
    assert.equal(body.data.books[0].imageUrl, 'https://books.example/cover.jpg');
    assert.deepEqual(body.data.books[0].price, { amount: 12.5, currencyCode: 'USD' });
  });
});

test('legacy search path remains supported', async () => {
  await withServer(async () => jsonResponse({ totalItems: 0, items: [] }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'Dune' }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).data.books, []);
  });
});

test('search rejects missing query without calling provider', async () => {
  let called = false;
  await withServer(async () => { called = true; }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/books/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'VALIDATION_ERROR');
    assert.equal(called, false);
  });
});

test('search rejects unsupported type and invalid pagination', async () => {
  await withServer(async () => jsonResponse({}), async (baseUrl) => {
    for (const body of [{ query: 'Dune', type: 'publisher' }, { query: 'Dune', maxResults: 41 }]) {
      const response = await fetch(`${baseUrl}/api/v1/books/search`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error.code, 'VALIDATION_ERROR');
    }
  });
});

test('book details returns normalized volume data', async () => {
  let requestedUrl;
  await withServer(async (url) => {
    requestedUrl = new URL(url);
    return jsonResponse(sampleVolume);
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/books/book_123`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(requestedUrl.pathname, '/books/v1/volumes/book_123');
    assert.equal(body.data.id, 'book_123');
    assert.equal(body.data.authors[0], 'F. Scott Fitzgerald');
  });
});

test('missing Google Books key returns a configuration error', async () => {
  await withServer(async () => { throw new Error('provider should not be called'); }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/books/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'Dune' }),
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, 'GOOGLE_BOOKS_API_KEY_MISSING');
  }, '');
});

test('Google Books 404 maps to a JSON book-not-found response', async () => {
  await withServer(async () => jsonResponse({ error: 'not found' }, 404), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/books/missing`);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error.code, 'BOOK_NOT_FOUND');
  });
});

test('provider errors are returned as a safe JSON 503', async () => {
  await withServer(async () => jsonResponse({}, 429), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/books/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'Dune' }),
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, 'BOOKS_PROVIDER_ERROR');
  });
});

test('malformed JSON is a short JSON 400 without a stack trace', async () => {
  await withServer(async () => { throw new Error('provider should not be called'); }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/books/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{invalid',
    });
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'INVALID_JSON');
    assert.equal(JSON.stringify(body).includes('SyntaxError'), false);
  });
});

test('CORS preflight allows the Flutter web origin and JSON POST', async () => {
  await withServer(async () => { throw new Error('provider should not be called'); }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/books/search`, {
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:3000',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), '*');
    assert.match(response.headers.get('access-control-allow-methods'), /POST/);
    assert.match(response.headers.get('access-control-allow-headers'), /content-type/i);
  });
});

test('unknown route returns a JSON 404', async () => {
  await withServer(async () => { throw new Error('provider should not be called'); }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/ocr/process`, { method: 'POST' });
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error.code, 'NOT_FOUND');
  });
});

test('PORT takes precedence and BACKEND_PORT remains a compatible fallback', () => {
  assert.equal(resolvePort({ PORT: '8123', BACKEND_PORT: '8000' }), 8123);
  assert.equal(resolvePort({ BACKEND_PORT: '8000' }), 8000);
  assert.equal(resolvePort({}), 5000);
  assert.throws(() => resolvePort({ PORT: 'invalid' }), /PORT must be an integer/);
});
