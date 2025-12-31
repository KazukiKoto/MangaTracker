# Manga Tracker

Manga tracking dashboard pairing a FastAPI backend with a Vite + React frontend. Automatically scans reader sites, surfaces overlapping titles, and syncs your "last read" state across browsers.

## Table of contents

1. [Feature highlights](#feature-highlights)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Quick start](#quick-start)
5. [Manual setup](#manual-setup)
6. [Configuration](#configuration)
7. [Using Manga Tracker](#using-manga-tracker)
8. [Data & persistence](#data--persistence)
9. [API reference](#api-reference)
10. [Troubleshooting](#troubleshooting)

## Feature highlights

- Track any manga reader that exposes a public catalogue; add pagination templates for multi-page listings.
- Match tracked series against live site snapshots (falling back to the mock catalog when a scan fails).
- Aggregate unread chapters per series, including synthetic rows when only "latest chapter" is known.
- Mark chapters as read from the dashboard or tracked view; progress persists in `series.json` and is shared across devices.
- Capture Cloudflare cookies via the re-auth flow to access gated sites.
- Serve the built React bundle directly from FastAPI for single-command deployments.

## Architecture

| Layer | Location | Notes |
| --- | --- | --- |
| Backend | backend/ | FastAPI + httpx scraper, in-memory caches, JSON store |
| Frontend | frontend/ | React 18, Vite, Tailwind, context-based app state |
| Data | backend/data/ | websites.json + series.json for persistence |

A background poller snapshots every tracked site roughly once per minute, storing the HTML in memory. `/api/matches` compares cached markup against your tracked titles and returns the newest chapter per source.

## Prerequisites

- Python 3.11+
- Node.js 18+
- Git (optional)
- PowerShell 7+ on Windows if you plan to use `start.ps1`

## Quick start

Windows users can bootstrap everything with one command:

```pwsh
./start.ps1
```

Flags:

- -SkipPipInstall – reuse existing Python dependencies.
- -SkipNpmInstall – skip npm install for faster repeats.

The script will:

1. Create/activate `.venv` in backend/ (if missing).
2. Install Python requirements.
3. Install frontend dependencies.
4. Build the React app.
5. Launch `uvicorn backend.main:app --reload`.

Visit `http://localhost:8000` (served SPA) or `http://localhost:5173` if you run `npm run dev`.

## Manual setup

### Backend

```pwsh
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Build the frontend once so FastAPI can serve frontend/dist:

```pwsh
cd ../frontend
npm install
npm run build
```

### Frontend dev server

```pwsh
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

Open `http://<your-ip:5173` for live reload while the API remains on `http://<your-ip:8000`.

## Configuration

- VITE_API_BASE – set when the frontend should call an API that is not `http://localhost:8000`.
- Pagination templates – configure per site (query mode adds `?page=...`, path mode substitutes `{page}` inside the URL).
- Authentication cookies – use the "Re-authenticate" action in the UI to capture Cloudflare tokens.

## Using Manga Tracker

1. Add websites: supply a label, base URL, and optional pagination strategy. The poller will begin caching the catalogue immediately.
2. Add series: enter the title plus any aliases. Site-specific overrides fix slug differences (e.g., Asura vs Flame naming).
3. Monitor overlaps:
- The Dashboard surfaces unread chapters with counts, latest chapter labels, and quick Mark Read buttons.
- Expand an entry to view a scrollable list of unread chapters. Clicking a chapter both opens it and records the read token.
4. Tracked view: browse all matches alphabetically, paginate large libraries, and jump straight to a source site.
5. Marking progress: Mark buttons and chapter clicks update `last_read_token` inside backend/data/series.json, keeping every browser in sync.
6. Refreshing data: use the Refresh button within the UI for a new `/api/matches` call. The backend poller separately refreshes cached HTML about once per minute.

## Data & persistence

- backend/data/websites.json – tracked sites, pagination info, overrides, and captured cookies.
- backend/data/series.json – titles, aliases, site overrides, and `last_read_token` for unread tracking.
- Cached HTML lives only in memory; restart the backend to purge it.
- Every API mutation writes immediately to disk for safe restarts.

## API reference

| Method | Route | Description |
| --- | --- | --- |
| GET | /api/sites | List tracked websites |
| POST | /api/sites | Create a website (supports pagination metadata) |
| PUT | /api/sites/{id} | Update labels, URLs, pagination, or cookies |
| DELETE | /api/sites/{id} | Remove a site and its cache |
| POST | /api/sites/{id}/reauth | Capture cookies from your browser for Cloudflare-protected hosts |
| GET | /api/series | List tracked series |
| POST | /api/series | Create a series with aliases and site overrides |
| PUT | /api/series/{id} | Update title, aliases, overrides, or `last_read_token` |
| DELETE | /api/series/{id} | Remove a series |
| GET | /api/matches | Return matches with `latest_chapter`, `latest_chapter_number`, and up to five recent chapters |

FastAPI also serves frontend/dist when the frontend has been built, so one process can host both API and UI.

## Troubleshooting

- No matches appear: ensure at least one site and one series exist, then click Refresh. Check backend logs for fetch errors if the site snapshot is missing.
- Chapters display "Unknown": some sites hide numbers entirely. Confirm pagination covers all catalogue pages and that the site exposes chapter digits.
- Cannot reach the app from another device: run both servers with --host 0.0.0.0, find your LAN IP via `ipconfig`, and allow ports 8000/5173 through the firewall.
- Frontend cannot hit the API: set VITE_API_BASE to the backend URL when running the dev server or hosting on separate ports.

Happy tracking!