'use strict';

const path = require('node:path');
const express = require('express');
const cors = require('cors');

// Load the backend-local environment only when starting the server directly.
// Tests import createApp and inject all external configuration explicitly.
if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
}

const GOOGLE_BOOKS_BASE_URL = 'https://www.googleapis.com/books/v1/volumes';
const REQUEST_TIMEOUT_MS = 10000;
const SEARCH_TYPES = new Set(['any', 'title', 'author', 'isbn']);

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function resolvePort(env = process.env) {
  const rawPort = env.PORT || env.BACKEND_PORT || 5000;
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  return port;
}

function errorResponse(res, status, code, message) {
  return res.status(status).json({
    success: false,
    error: { code, message },
  });
}

function normalizeVolume(volume) {
  const info = volume.volumeInfo || {};
  const sale = volume.saleInfo || {};
  const image = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || null;
  const price = sale.retailPrice || sale.listPrice || null;

  return {
    id: volume.id,
    title: info.title || 'Untitled',
    subtitle: info.subtitle || null,
    authors: info.authors || [],
    description: info.description || null,
    publisher: info.publisher || null,
    publishedDate: info.publishedDate || null,
    pageCount: info.pageCount || null,
    categories: info.categories || [],
    language: info.language || null,
    averageRating: Number.isFinite(info.averageRating) ? info.averageRating : null,
    ratingsCount: Number.isFinite(info.ratingsCount) ? info.ratingsCount : 0,
    isbn: (info.industryIdentifiers || []).map(({ type, identifier }) => ({ type, identifier })),
    imageUrl: image ? image.replace(/^http:/i, 'https:') : null,
    infoLink: info.infoLink || null,
    price: price ? { amount: price.amount, currencyCode: price.currencyCode } : null,
  };
}

function buildSearchQuery(query, type) {
  const prefixes = { title: 'intitle', author: 'inauthor', isbn: 'isbn' };
  return prefixes[type] ? `${prefixes[type]}:${query}` : query;
}

function createApp({
  fetchImpl = globalThis.fetch,
  apiKey = process.env.GOOGLE_BOOKS_API_KEY,
  port = resolvePort(),
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  async function requestGoogleBooks(url) {
    if (!apiKey) {
      throw new ApiError(503, 'GOOGLE_BOOKS_API_KEY_MISSING', 'Book search is not configured on this server.');
    }

    let response;
    try {
      response = await fetchImpl(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch {
      throw new ApiError(503, 'BOOKS_PROVIDER_UNAVAILABLE', 'The book information service is temporarily unavailable.');
    }

    if (response.status === 404) {
      throw new ApiError(404, 'BOOK_NOT_FOUND', 'No book was found for that identifier.');
    }
    if (!response.ok) {
      const status = response.status === 429 || response.status >= 500 ? 503 : 502;
      throw new ApiError(status, 'BOOKS_PROVIDER_ERROR', 'The book information service could not complete the request.');
    }

    try {
      return await response.json();
    } catch {
      throw new ApiError(503, 'BOOKS_PROVIDER_INVALID_RESPONSE', 'The book information service returned an invalid response.');
    }
  }

  app.get('/api/health', (_req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      port,
    });
  });

  async function searchBooks(req, res, next) {
    try {
      const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
      const query = typeof body.query === 'string' ? body.query.trim() : '';
      const type = body.type === undefined ? 'any' : body.type;
      const maxResults = body.maxResults === undefined ? 10 : body.maxResults;
      const startIndex = body.startIndex === undefined ? 0 : body.startIndex;

      if (!query || query.length > 200) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'query is required and must be 1 to 200 characters.');
      }
      if (typeof type !== 'string' || !SEARCH_TYPES.has(type)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'type must be one of: any, title, author, isbn.');
      }
      if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > 40) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'maxResults must be an integer from 1 to 40.');
      }
      if (!Number.isInteger(startIndex) || startIndex < 0 || startIndex > 100000) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'startIndex must be an integer from 0 to 100000.');
      }

      const params = new URLSearchParams({
        q: buildSearchQuery(query, type),
        maxResults: String(maxResults),
        startIndex: String(startIndex),
      });
      params.set('key', apiKey || '');
      const result = await requestGoogleBooks(`${GOOGLE_BOOKS_BASE_URL}?${params}`);

      return res.status(200).json({
        success: true,
        data: {
          query,
          totalItems: Number.isInteger(result.totalItems) ? result.totalItems : 0,
          books: Array.isArray(result.items) ? result.items.map(normalizeVolume) : [],
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  app.post(['/api/v1/books/search', '/api/v1/search'], searchBooks);

  app.get('/api/v1/books/:id', async (req, res, next) => {
    try {
      const id = req.params.id.trim();
      if (!id || id.length > 200) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'A valid book id is required.');
      }

      const result = await requestGoogleBooks(`${GOOGLE_BOOKS_BASE_URL}/${encodeURIComponent(id)}?key=${encodeURIComponent(apiKey || '')}`);
      return res.status(200).json({ success: true, data: normalizeVolume(result) });
    } catch (error) {
      return next(error);
    }
  });

  app.use((_req, res) => errorResponse(res, 404, 'NOT_FOUND', 'The requested API route was not found.'));

  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.parse.failed') {
      return errorResponse(res, 400, 'INVALID_JSON', 'Request body must contain valid JSON.');
    }
    if (error.type === 'entity.too.large') {
      return errorResponse(res, 413, 'PAYLOAD_TOO_LARGE', 'Request body must not exceed 1 MB.');
    }
    if (error instanceof ApiError) {
      return errorResponse(res, error.status, error.code, error.message);
    }
    return errorResponse(res, 500, 'INTERNAL_SERVER_ERROR', 'An unexpected server error occurred.');
  });

  return app;
}

if (require.main === module) {
  const port = resolvePort();
  createApp({ port }).listen(port, () => {
    console.log(`\n✅ Server running on http://localhost:${port}\nReady to accept requests! 🚀\n`);
  });
}

module.exports = { createApp, resolvePort };
