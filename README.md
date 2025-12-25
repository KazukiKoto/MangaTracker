# Manga Tracker

Full-stack prototype that pairs a FastAPI service with a Vite + React + Tailwind UI. It keeps track of the manga sites you poll, the series you are following, and shows overlaps backed by a mock catalog until real scrapers or feeds are plugged in.

## Stack

- **Backend**: FastAPI, uvicorn, in-memory store + mock catalogs (`backend/`).
- **Frontend**: React 18, Vite, Tailwind CSS (`frontend/`).
- **Design**: Bold gradient background, glassy panels, built for desktop + mobile.

## Getting started

### Backend

1. `cd backend`
2. (Optional) `python -m venv .venv && .\.venv\Scripts\activate`
3. `pip install -r requirements.txt`
4. Build the frontend once (`cd ../frontend && npm run build`) so the FastAPI app can serve `frontend/dist`.
5. `uvicorn main:app --reload --host 0.0.0.0`

### Frontend

1. `cd frontend`
2. `npm install`
3. `npm run dev -- --host 0.0.0.0`
4. Visit `http://<your-computer-ip>:5173`

Set `VITE_API_BASE` if your FastAPI server is not on `http://localhost:8000`.

### Accessing the app from other devices on your network

- **Find your machine's LAN IP** using `ipconfig` (Windows) or `ip addr`/`ifconfig` (macOS/Linux). It typically looks like `192.168.x.x`.
- **Backend**: Whether you run `uvicorn main:app --reload --host 0.0.0.0` manually or via `./start.ps1`, the API binds to all interfaces. Other devices can call `http://<your-computer-ip>:8000` once your OS firewall allows inbound connections.
- **Frontend dev server**: `npm run dev -- --host 0.0.0.0` already binds to every interface per `vite.config.js`. Visit `http://<your-computer-ip>:5173` from phones/tablets on the same network. If you built the frontend (`npm run build`), FastAPI serves it from `http://<your-computer-ip>:8000`.
- **Firewall reminder**: Approve the prompts the first time uvicorn or Vite asks for network access, or manually allow ports 8000/5173 so other devices can connect.

### One-command startup (PowerShell)

On Windows you can use the provided helper:

```pwsh
./start.ps1
```

It will create a `.venv` if needed, install backend dependencies, run `npm install` (unless `-SkipNpmInstall`), build the React app, and finally launch `uvicorn backend.main:app --reload`. Use `-SkipPipInstall` or `-SkipNpmInstall` to speed up repeated runs.

## Data persistence

- Websites and series are stored as JSON under `backend/data/websites.json` and `backend/data/series.json`.
- Every change through the API immediately saves back to disk so the tracker survives restarts.
- HTML snapshots fetched from each site live only in memory and refresh roughly once per minute.

### Pagination options

- Each tracked website can optionally describe how it paginates its catalogue.
- Query mode: specify the parameter name (e.g., `page`) plus the starting page and how many pages to scan.
- Path mode: provide a full template containing `{page}` (e.g., `https://site.com/list/{page}`) along with the range to fetch.
- Configure these either through the UI form or by POSTing `pagination` details when creating a site.

## API overview

- `GET /api/sites` | `POST /api/sites` | `DELETE /api/sites/{id}`
- `GET /api/series` | `POST /api/series` | `DELETE /api/series/{id}`
- `GET /api/matches` reads from the cached HTML snapshots (kept fresh by a background poller that re-fetches every minute), scanning anchor/headline text to match full series titles (with fuzzy safeguards so short names don't collide). Each source entry includes the clickable URL detected on the site plus the most recent chapter number (when it can be parsed). Pagination-aware sites contribute multiple pages per poll. The route falls back to `mock_catalogs` only if a site cannot be fetched.
	- Each `sources[]` entry now also exposes `latest_chapter_number` (a float) so consumers can order by freshness; the API already returns sources sorted by newest chapter.
- The FastAPI app also serves the built React bundle from `frontend/dist`, so deploying only requires the backend once `npm run build` has been run.

## Next steps ideas

- Swap the mock catalog for real scraping or upstream APIs.
- Persist websites/series in a database instead of memory.
- Enrich matches with chapter numbers or unread counts.
- Add auth so users can sync their reading queues between devices.
