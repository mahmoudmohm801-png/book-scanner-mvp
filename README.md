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

## Backend API: verified status

The backend currently exposes two routes. The search route is a connectivity stub; it does not search for books yet.

| Method | Path | Current behavior |
|---|---|---|
| `GET` | `/api/health` | Returns HTTP 200 with `status: "healthy"` and a timestamp. |
| `POST` | `/api/v1/search` | Returns HTTP 200 with `{ "success": true, "message": "Server is working!" }`. The handler does not validate `query` or perform a search. |
| `GET` | `/api/v1/books/:id` | Not implemented; requests currently return 404. |
| `POST` | `/api/v1/ocr/process` | Not implemented; requests currently return 404. |

### Start and verify the backend

From the repository root:

```powershell
cd backend
npm install
npm run dev
```

The app reads `PORT` and defaults to port `5000`. The current local server responds on port `8000`. Note that the root `.env.example` currently names this setting `BACKEND_PORT`; that name does not override the `PORT` variable read by `backend/app.js`.

Check health:

```powershell
Invoke-RestMethod http://localhost:8000/api/health
```

Check the search stub:

```powershell
$body = @{ query = "The Hobbit" } | ConvertTo-Json
Invoke-RestMethod `
  -Uri "http://localhost:8000/api/v1/search" `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
```

Expected search-stub response:

```json
{
  "success": true,
  "message": "Server is working!"
}
```

### Verified behavior and remaining work

- CORS is enabled with the Express `cors()` default configuration. Local preflight checks confirmed origin `*`, allowed `POST`, and allowed the `content-type` request header.
- Malformed JSON returns HTTP 400, but currently uses Express's default HTML error page and exposes a parser stack trace. Add centralized JSON error handling before production use.
- Book lookup and OCR routes must be implemented before clients can call them.
- Replace the search stub with input validation and a real book-search implementation before integrating search results in Flutter.
