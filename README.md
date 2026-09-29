# 📚 AI Book Scanner MVP

A Flutter and Node.js project for scanning book covers, reading their text with OCR, and looking up book information.

---

## Project structure

```text
book-scanner-mvp/
├── backend/    # Node.js and Express API
├── frontend/   # Flutter application
├── .env.example
└── README.md
```

## Backend API

The backend uses Google Books API for public book search and details. Put the API key in `backend/.env` as `GOOGLE_BOOKS_API_KEY`; never commit the real key. The `.env.example` file contains placeholders only. The MVP does not require a database: book metadata is fetched from Google Books on demand.

| Method | Path | Request | Behavior |
|---|---|---|---|
| `GET` | `/api/health` | — | Returns status, timestamp, uptime, and configured port. |
| `POST` | `/api/v1/books/search` | JSON `{ "query": "The Great Gatsby", "type": "title", "maxResults": 10, "startIndex": 0 }` | Searches books. `query` is required (1–200 chars); `type` may be `any`, `title`, `author`, or `isbn`; `maxResults` is 1–40. |
| `POST` | `/api/v1/search` | Same as search above | Backward-compatible alias for `/api/v1/books/search`. |
| `GET` | `/api/v1/books/:id` | Google Books volume ID in the path | Returns one normalized book or a JSON 404. |

Successful search response:

```json
{
  "success": true,
  "data": {
    "query": "The Great Gatsby",
    "totalItems": 1,
    "books": [
      {
        "id": "volume-id",
        "title": "The Great Gatsby",
        "authors": ["F. Scott Fitzgerald"],
        "description": "Book description",
        "averageRating": 4.2,
        "ratingsCount": 25,
        "imageUrl": "https://books.google.com/...",
        "price": { "amount": 12.5, "currencyCode": "USD" }
      }
    ]
  }
}
```

Errors use a consistent JSON shape:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "query is required and must be 1 to 200 characters."
  }
}
```

Common status codes: `400` invalid input/JSON, `404` unknown route or book, `413` body over 1 MB, `502` provider error, `503` missing API key or provider unavailable, and `500` unexpected server error. Provider responses and stack traces are not returned to clients.

OCR is intentionally on-device with Google ML Kit in Flutter. The app sends the recognized title/author text to the search endpoint; there is no backend `/api/v1/ocr/process` route in this MVP.

CORS is enabled for local development. Restrict allowed origins before deploying publicly.

## Run locally on Windows PowerShell

From the repository root:

```powershell
cd backend
npm install
npm run dev
```

The backend reads `PORT` first, then the legacy `BACKEND_PORT`, then defaults to `5000`. The sample config uses `PORT=8000`. Create `backend/.env` locally and set `GOOGLE_BOOKS_API_KEY` there. Do not commit that file.

Health check:

```powershell
Invoke-RestMethod http://localhost:8000/api/health
```

Search by title:

```powershell
$body = @{
  query = "The Great Gatsby"
  type = "title"
  maxResults = 10
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "http://localhost:8000/api/v1/books/search" `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
```

Get book details (replace the sample ID with a real ID returned by search):

```powershell
Invoke-RestMethod "http://localhost:8000/api/v1/books/volume-id"
```

Run backend tests:

```powershell
cd backend
npm test
```

Tests use a mocked Google Books response and do not need a real API key or network access.
