from __future__ import annotations

import asyncio
import logging
import os
import subprocess
from contextlib import suppress
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import time
from typing import Any, Dict, Iterable, List, Optional, Tuple, Literal, Set
from uuid import uuid4
from difflib import SequenceMatcher

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import httpx
from pydantic import BaseModel, Field, HttpUrl, ValidationError
from urllib.parse import urljoin, urlparse, urlunparse, urlencode, parse_qs
from bs4 import BeautifulSoup

try:
    import browser_cookie3
except ImportError:  # pragma: no cover - handled at runtime
    browser_cookie3 = None

logging.basicConfig(level=logging.INFO)
app = FastAPI(title="Manga Tracker API", version="0.1.0")

logger = logging.getLogger("manga_tracker")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIST = BASE_DIR / "frontend" / "dist"
INDEX_HTML = FRONTEND_DIST / "index.html"

assets_dir = FRONTEND_DIST / "assets"
if assets_dir.exists():
    app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

DATA_DIR = Path(__file__).resolve().parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
WEBSITES_FILE = DATA_DIR / "websites.json"
SERIES_FILE = DATA_DIR / "series.json"


def load_json_records(path: Path) -> List[Dict]:
    if not path.exists():
        return []
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except json.JSONDecodeError:
        logger.warning("Failed to parse %s, defaulting to empty list", path)
        return []


def write_json_records(path: Path, payload: List[Dict]) -> None:
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)


def normalize_optional_str(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    candidate = value.strip()
    return candidate or None


def normalize_site_overrides(overrides: Optional[Dict[str, str]]) -> Dict[str, str]:
    if not overrides:
        return {}
    result: Dict[str, str] = {}
    for key, value in overrides.items():
        if key is None or value is None:
            continue
        host = key.strip().lower()
        handle = value.strip()
        if host and handle:
            result[host] = handle
    return result


def site_to_public(site: Website) -> WebsitePublic:
    return WebsitePublic(
        id=site.id,
        label=site.label,
        url=site.url,
        pagination=site.pagination,
        series_url_template=site.series_url_template,
        chapter_url_template=site.chapter_url_template,
        last_reauth_at=site.last_reauth_at,
    )


def _domain_matches(cookie_domain: str, host: str) -> bool:
    if not cookie_domain or not host:
        return False
    cdomain = cookie_domain.lstrip(".").lower()
    host = host.lstrip(".").lower()
    return host == cdomain or host.endswith(f".{cdomain}") or cdomain.endswith(f".{host}")


def collect_browser_cookies(host: str, include_names: Optional[Set[str]] = None) -> List[StoredCookie]:
    if not host or browser_cookie3 is None:
        return []
    include = {name.lower() for name in include_names} if include_names else None
    try:
        jar = browser_cookie3.load(domain_name=host)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Unable to load browser cookies for %s: %s", host, exc)
        return []
    results: List[StoredCookie] = []
    for cookie in jar:
        name = getattr(cookie, "name", "")
        if not name:
            continue
        if include and name.lower() not in include:
            continue
        domain = getattr(cookie, "domain", "")
        if not _domain_matches(domain, host):
            continue
        value = getattr(cookie, "value", None)
        if value is None:
            continue
        results.append(
            StoredCookie(
                name=name,
                value=value,
                domain=domain,
                path=getattr(cookie, "path", None) or "/",
                expires=getattr(cookie, "expires", None),
                secure=bool(getattr(cookie, "secure", False)),
            )
        )
    return results


def site_cookie_values(site: Website) -> Dict[str, str]:
    cookies: Dict[str, str] = {}
    for entry in getattr(site, "auth_cookies", []) or []:
        if isinstance(entry, dict):
            name = entry.get("name")
            value = entry.get("value")
        else:
            name = getattr(entry, "name", None)
            value = getattr(entry, "value", None)
        if not name or value is None:
            continue
        cookies[name] = value
    return cookies


def ensure_cookie_capture_ready() -> bool:
    if browser_cookie3 is None:
        return False
    if os.name != "posix":
        return True
    if os.environ.get("DBUS_SESSION_BUS_ADDRESS"):
        return True
    try:
        output = subprocess.check_output(["dbus-launch"], text=True)
    except (FileNotFoundError, subprocess.CalledProcessError) as exc:
        logger.warning("dbus-launch unavailable, cannot capture browser cookies: %s", exc)
        return False
    for line in output.splitlines():
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        if key and value:
            os.environ[key.strip()] = value.strip()
    return bool(os.environ.get("DBUS_SESSION_BUS_ADDRESS"))


def build_manual_cookies(host: str, entries: Dict[str, str]) -> List[StoredCookie]:
    domain = host if host.startswith(".") else f".{host}"
    cookies: List[StoredCookie] = []
    for name, value in entries.items():
        if not name or value is None:
            continue
        cookies.append(
            StoredCookie(
                name=name.strip(),
                value=str(value).strip(),
                domain=domain,
                path="/",
                secure=True,
            )
        )
    return cookies

SCAN_TIMEOUT = httpx.Timeout(10.0, connect=5.0)
MAX_RESPONSE_BYTES = 1_000_000
USER_AGENT = "MangaTrackerBot/0.1 (+https://github.com/)"
POLL_INTERVAL_SECONDS = 60
CHAPTER_REGEX = re.compile(r"(?:chapter|ch\.?|c)\s*(\d+(?:\.\d+)?)", re.IGNORECASE)
MAX_CANDIDATE_ELEMENTS = 8000

poller_task: asyncio.Task | None = None


class WebsiteCreate(BaseModel):
    label: str
    url: HttpUrl
    pagination: Optional["PaginationConfig"] = None
    series_url_template: Optional[str] = None
    chapter_url_template: Optional[str] = None


class StoredCookie(BaseModel):
    name: str
    value: str
    domain: Optional[str] = None
    path: Optional[str] = "/"
    expires: Optional[float] = None
    secure: bool = False


class Website(WebsiteCreate):
    id: str
    auth_cookies: List[StoredCookie] = Field(default_factory=list)
    last_reauth_at: Optional[datetime] = None


class WebsiteUpdate(BaseModel):
    label: Optional[str] = None
    url: Optional[HttpUrl] = None
    pagination: Optional[PaginationConfig | None] = None
    series_url_template: Optional[str | None] = None
    chapter_url_template: Optional[str | None] = None
    auth_cookies: Optional[List[StoredCookie]] = None


class WebsitePublic(WebsiteCreate):
    id: str
    last_reauth_at: Optional[datetime] = None


class ReauthRequest(BaseModel):
    wait_seconds: int = 45
    include_names: List[str] = Field(default_factory=lambda: ["cf_clearance", "__cf_bm"])
    manual_cookies: Optional[Dict[str, str]] = None


class ReauthResponse(BaseModel):
    cookies_found: int
    last_reauth_at: datetime


class SeriesCreate(BaseModel):
    title: str
    aliases: List[str] = Field(default_factory=list)
    site_overrides: Dict[str, str] = Field(default_factory=dict)


class Series(SeriesCreate):
    id: str


class SeriesUpdate(BaseModel):
    title: Optional[str] = None
    aliases: Optional[List[str]] = None
    site_overrides: Optional[Dict[str, str]] = None


class ChapterListing(BaseModel):
    label: Optional[str] = None
    number: Optional[float] = None
    link: Optional[str] = None
    detected_at: Optional[datetime] = None


class SourceHit(BaseModel):
    site: str
    link: Optional[str] = None
    latest_chapter: Optional[str] = None
    latest_chapter_number: Optional[float] = None
    recent_chapters: List[ChapterListing] = Field(default_factory=list)
    series_url_template: Optional[str] = None
    chapter_url_template: Optional[str] = None
    site_host: Optional[str] = None
    series_url_template: Optional[str] = None
    chapter_url_template: Optional[str] = None


class Match(BaseModel):
    title: str
    sources: List[SourceHit]


CandidateEntry = Dict[str, Any]


class PaginationConfig(BaseModel):
    strategy: Literal["query", "path"] = "query"
    parameter: Optional[str] = None
    template: Optional[str] = None
    start: int = 1
    pages: int = 1


class InMemoryStore:
    def __init__(self) -> None:
        self.websites: Dict[str, Website] = {}
        self.series: Dict[str, Series] = {}
        self.site_cache: Dict[str, str] = {}
        self.site_cache_meta: Dict[str, datetime] = {}
        self._load_from_disk()

    def add_site(self, payload: WebsiteCreate) -> Website:
        normalized = normalize_host(str(payload.url))
        for existing in self.websites.values():
            if normalize_host(str(existing.url)) == normalized:
                raise HTTPException(status_code=409, detail="Website already tracked")
        site = Website(
            id=str(uuid4()),
            label=payload.label.strip(),
            url=payload.url,
            pagination=payload.pagination,
            series_url_template=normalize_optional_str(payload.series_url_template),
            chapter_url_template=normalize_optional_str(payload.chapter_url_template),
        )
        self.websites[site.id] = site
        self._persist_websites()
        return site

    def remove_site(self, site_id: str) -> None:
        if site_id not in self.websites:
            raise HTTPException(status_code=404, detail="Website not found")
        del self.websites[site_id]
        self.site_cache.pop(site_id, None)
        self.site_cache_meta.pop(site_id, None)
        self._persist_websites()

    def update_site(self, site_id: str, payload: WebsiteUpdate) -> Website:
        site = self.websites.get(site_id)
        if site is None:
            raise HTTPException(status_code=404, detail="Website not found")

        update_data = payload.model_dump(exclude_unset=True)
        if "label" in update_data and update_data["label"] is not None:
            update_data["label"] = update_data["label"].strip()
        if "url" in update_data and update_data["url"] is not None:
            normalized = normalize_host(str(update_data["url"]))
            for existing_id, existing in self.websites.items():
                if existing_id == site_id:
                    continue
                if normalize_host(str(existing.url)) == normalized:
                    raise HTTPException(status_code=409, detail="Website already tracked")
            # purge cached snapshot if the URL changes
            self.site_cache.pop(site_id, None)
            self.site_cache_meta.pop(site_id, None)
        if "pagination" in update_data:
            # allow clearing pagination by passing null
            update_data["pagination"] = update_data["pagination"]
        if "series_url_template" in update_data:
            update_data["series_url_template"] = normalize_optional_str(
                update_data["series_url_template"]
            )
        if "chapter_url_template" in update_data:
            update_data["chapter_url_template"] = normalize_optional_str(
                update_data["chapter_url_template"]
            )

        updated = site.model_copy(update=update_data)
        self.websites[site_id] = updated
        self._persist_websites()
        return updated

    def update_site_cookies(self, site_id: str, cookies: List[StoredCookie]) -> Website:
        site = self.websites.get(site_id)
        if site is None:
            raise HTTPException(status_code=404, detail="Website not found")
        timestamp = datetime.now(timezone.utc)
        updated = site.model_copy(update={"auth_cookies": cookies, "last_reauth_at": timestamp})
        self.websites[site_id] = updated
        self._persist_websites()
        return updated

    def add_series(self, payload: SeriesCreate) -> Series:
        title = payload.title.strip()
        if not title:
            raise HTTPException(status_code=400, detail="Title cannot be empty")
        aliases = normalize_aliases(payload.aliases)
        candidate_tokens = series_tokens(title, aliases)
        for existing in self.series.values():
            existing_tokens = series_tokens(existing.title, getattr(existing, "aliases", []) or [])
            if candidate_tokens & existing_tokens:
                raise HTTPException(status_code=409, detail="Series already tracked")
        record = Series(
            id=str(uuid4()),
            title=title,
            aliases=aliases,
            site_overrides=normalize_site_overrides(payload.site_overrides),
        )
        self.series[record.id] = record
        self._persist_series()
        return record

    def remove_series(self, series_id: str) -> None:
        if series_id not in self.series:
            raise HTTPException(status_code=404, detail="Series not found")
        del self.series[series_id]
        self._persist_series()

    def update_series(self, series_id: str, payload: SeriesUpdate) -> Series:
        record = self.series.get(series_id)
        if record is None:
            raise HTTPException(status_code=404, detail="Series not found")

        update_data = payload.model_dump(exclude_unset=True)
        candidate_title = update_data.get("title", record.title)
        if "title" in update_data and update_data["title"] is not None:
            candidate_title = update_data["title"].strip()
            if not candidate_title:
                raise HTTPException(status_code=400, detail="Title cannot be empty")
            update_data["title"] = candidate_title
        candidate_aliases = update_data.get("aliases", record.aliases or [])
        if "aliases" in update_data:
            candidate_aliases = normalize_aliases(update_data["aliases"])
            update_data["aliases"] = candidate_aliases

        if "site_overrides" in update_data:
            update_data["site_overrides"] = normalize_site_overrides(update_data["site_overrides"])

        candidate_tokens = series_tokens(candidate_title, candidate_aliases)
        for existing_id, existing in self.series.items():
            if existing_id == series_id:
                continue
            existing_tokens = series_tokens(existing.title, getattr(existing, "aliases", []) or [])
            if candidate_tokens & existing_tokens:
                raise HTTPException(status_code=409, detail="Series already tracked")

        updated = record.model_copy(update=update_data)
        self.series[series_id] = updated
        self._persist_series()
        return updated

    def record_site_snapshot(
        self, site_id: str, body: str | None, timestamp: datetime | None = None
    ) -> None:
        if body:
            self.site_cache[site_id] = body
            self.site_cache_meta[site_id] = timestamp or datetime.now(timezone.utc)
        else:
            self.site_cache.pop(site_id, None)
            self.site_cache_meta.pop(site_id, None)

    def _load_from_disk(self) -> None:
        for payload in load_json_records(WEBSITES_FILE):
            try:
                site = Website(**payload)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Skipping invalid site payload %s: %s", payload, exc)
                continue
            self.websites[site.id] = site

        for payload in load_json_records(SERIES_FILE):
            try:
                record = Series(**payload)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Skipping invalid series payload %s: %s", payload, exc)
                continue
            self.series[record.id] = record

    def _persist_websites(self) -> None:
        write_json_records(
            WEBSITES_FILE,
            [site.model_dump(mode="json") for site in self.websites.values()],
        )

    def _persist_series(self) -> None:
        write_json_records(
            SERIES_FILE,
            [record.model_dump(mode="json") for record in self.series.values()],
        )


store = InMemoryStore()

mock_catalogs: Dict[str, List[str]] = {
    "mangadex.org": [
        "Frieren: Beyond Journey's End",
        "Blue Period",
        "Mission: Yozakura Family",
        "Delicious in Dungeon",
    ],
    "manganato.com": [
        "One Piece",
        "Blue Lock",
        "Frieren: Beyond Journey's End",
        "Skip and Loafer",
    ],
    "tcbscans.com": [
        "One Piece",
        "Chainsaw Man",
        "My Hero Academia",
    ],
    "comikey.com": [
        "My Wife Has No Emotion",
        "Kowloon Generic Romance",
        "The Summer You Were There",
    ],
}


@app.on_event("startup")
async def start_poller() -> None:
    global poller_task
    if poller_task is None:
        poller_task = asyncio.create_task(poll_sites_loop())


@app.on_event("shutdown")
async def stop_poller() -> None:
    global poller_task
    if poller_task:
        poller_task.cancel()
        with suppress(asyncio.CancelledError):
            await poller_task
        poller_task = None


@app.get("/health")
def healthcheck() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/api/sites", response_model=List[WebsitePublic])
def list_sites() -> List[WebsitePublic]:
    return [site_to_public(site) for site in store.websites.values()]


@app.post("/api/sites", response_model=WebsitePublic, status_code=201)
async def create_site(payload: WebsiteCreate) -> WebsitePublic:
    site = store.add_site(payload)
    asyncio.create_task(refresh_site_cache([site]))
    return site_to_public(site)


@app.put("/api/sites/{site_id}", response_model=WebsitePublic)
async def update_site(site_id: str, payload: WebsiteUpdate) -> WebsitePublic:
    site = store.update_site(site_id, payload)
    asyncio.create_task(refresh_site_cache([site]))
    return site_to_public(site)


@app.post("/api/sites/{site_id}/reauth", response_model=ReauthResponse)
async def reauthenticate_site(site_id: str, payload: ReauthRequest = ReauthRequest()) -> ReauthResponse:
    site = store.websites.get(site_id)
    if site is None:
        raise HTTPException(status_code=404, detail="Website not found")
    host = normalize_host(str(site.url))
    if not host:
        raise HTTPException(status_code=400, detail="Unable to determine host for website")
    manual_entries = {k: v for k, v in (payload.manual_cookies or {}).items() if v}
    if manual_entries:
        cookies = build_manual_cookies(host, manual_entries)
        if not cookies:
            raise HTTPException(status_code=400, detail="No valid cookie values supplied")
        updated = store.update_site_cookies(site_id, cookies)
        return ReauthResponse(cookies_found=len(cookies), last_reauth_at=updated.last_reauth_at)
    if browser_cookie3 is None:
        raise HTTPException(
            status_code=500,
            detail=(
                "Automatic capture unavailable (missing browser_cookie3). Provide cookie values manually.",
            ),
        )
    if not ensure_cookie_capture_ready():
        raise HTTPException(
            status_code=503,
            detail=(
                "Automatic capture unavailable (no DBus session). Install dbus-launch / run inside a desktop session, "
                "or paste cf_clearance manually."
            ),
        )
    include_names = {name.lower() for name in payload.include_names} if payload.include_names else None
    wait_seconds = max(5, min(payload.wait_seconds or 0, 180))
    deadline = time.monotonic() + wait_seconds
    while True:
        cookies = await asyncio.to_thread(collect_browser_cookies, host, include_names)
        if cookies:
            updated = store.update_site_cookies(site_id, cookies)
            return ReauthResponse(cookies_found=len(cookies), last_reauth_at=updated.last_reauth_at)
        if time.monotonic() >= deadline:
            raise HTTPException(
                status_code=408,
                detail="Cloudflare cookies were not detected. Complete the verification challenge and try again.",
            )
        await asyncio.sleep(2.0)


@app.delete("/api/sites/{site_id}", status_code=204)
def delete_site(site_id: str) -> Response:
    store.remove_site(site_id)
    return Response(status_code=204)


@app.get("/api/series", response_model=List[Series])
def list_series() -> List[Series]:
    return list(store.series.values())


@app.post("/api/series", response_model=Series, status_code=201)
def create_series(payload: SeriesCreate) -> Series:
    return store.add_series(payload)


@app.put("/api/series/{series_id}", response_model=Series)
def update_series(series_id: str, payload: SeriesUpdate) -> Series:
    return store.update_series(series_id, payload)


@app.delete("/api/series/{series_id}", status_code=204)
def delete_series(series_id: str) -> Response:
    store.remove_series(series_id)
    return Response(status_code=204)


@app.get("/api/matches", response_model=List[Match])
async def now_reading() -> List[Match]:
    if not store.websites or not store.series:
        return []

    series_terms = build_series_terms(store.series.values())
    if not series_terms:
        return []

    canonical_map = build_canonical_map(store.series.values())

    websites = list(store.websites.values())
    matches, missing_cache = await scan_sites_for_series(websites, series_terms)
    if matches:
        return matches

    if missing_cache:
        logger.info("Cache missing for some sites, triggering async refresh")
        asyncio.create_task(refresh_site_cache(websites))

    # Fallback to mock catalogs when live scanning yields nothing
    return collect_mock_matches(websites, canonical_map)


def _get_index_file() -> Path:
    if INDEX_HTML.exists():
        return INDEX_HTML
    raise HTTPException(
        status_code=503,
        detail="Frontend build not found. Run 'npm run build' inside frontend/",
    )


@app.get("/", include_in_schema=False)
def serve_index() -> FileResponse:
    return FileResponse(_get_index_file())


@app.get("/{full_path:path}", include_in_schema=False)
def serve_spa(full_path: str) -> FileResponse:
    if full_path.startswith("api"):
        raise HTTPException(status_code=404, detail="Not found")

    candidate = FRONTEND_DIST / full_path
    if candidate.exists() and candidate.is_file():
        return FileResponse(candidate)

    return FileResponse(_get_index_file())


async def scan_sites_for_series(
    websites: List[Website], series_terms: List[Dict[str, str]]
) -> tuple[List[Match], bool]:
    if not websites or not series_terms:
        return ([], False)

    return matches_from_cache(websites, series_terms)


def matches_from_cache(
    websites: List[Website], series_terms: List[Dict[str, str]]
) -> tuple[List[Match], bool]:
    if not series_terms:
        return ([], False)

    match_index: Dict[str, Dict[str, SourceHit]] = {}
    missing_cache = False
    for site in websites:
        body = store.site_cache.get(site.id)
        if not body:
            missing_cache = True
            continue
        soup = build_soup(body)
        if soup is None:
            continue
        source_label = site.label or normalize_host(str(site.url))
        series_template = site.series_url_template
        chapter_template = site.chapter_url_template
        site_host = urlparse(str(site.url)).netloc.lower()
        candidates = extract_candidate_entries(soup, str(site.url))
        detected_at = store.site_cache_meta.get(site.id)
        for term in series_terms:
            search_label = term["search"]
            display_title = term["display"]
            hit = locate_series_hit(candidates, search_label, str(site.url), detected_at)
            if not hit:
                continue
            link, chapter_label, chapter_number, chapter_list = hit
            match_index.setdefault(display_title, {})[source_label] = SourceHit(
                site=source_label,
                link=link or str(site.url),
                latest_chapter=chapter_label,
                latest_chapter_number=chapter_number,
                recent_chapters=chapter_list,
                series_url_template=series_template,
                chapter_url_template=chapter_template,
                site_host=site_host,
            )
    return (serialize_matches(match_index), missing_cache)


async def poll_sites_loop() -> None:
    while True:
        try:
            await refresh_site_cache()
        except Exception as exc:  # noqa: BLE001
            logger.exception("Site polling failed: %s", exc)
        await asyncio.sleep(POLL_INTERVAL_SECONDS)


async def refresh_site_cache(websites: List[Website] | None = None) -> None:
    targets = websites or list(store.websites.values())
    if not targets:
        return
    bodies = await fetch_site_bodies(targets)
    timestamp = datetime.now(timezone.utc)
    for site, body in zip(targets, bodies):
        log_site_body(site, body)
        store.record_site_snapshot(site.id, body or None, timestamp)


async def fetch_site_bodies(websites: List[Website]) -> List[str]:
    if not websites:
        return []
    async with httpx.AsyncClient(
        follow_redirects=True,
        timeout=SCAN_TIMEOUT,
        headers={"user-agent": USER_AGENT},
    ) as client:
        return await asyncio.gather(
            *[fetch_site_body(client, site) for site in websites]
        )


async def fetch_site_body(client: httpx.AsyncClient, site: Website) -> str:
    page_urls = build_page_urls(site)
    pages: List[str] = []
    cookie_values = site_cookie_values(site)
    for page_url in page_urls:
        try:
            response = await client.get(page_url, cookies=cookie_values or None)
            response.raise_for_status()
            text = response.text
            if len(text) > MAX_RESPONSE_BYTES:
                text = text[:MAX_RESPONSE_BYTES]
            pages.append(text)
        except httpx.HTTPError as exc:
            logger.warning("Failed to scan %s: %s", page_url, exc)
            continue
    return "\n<!--page-break-->\n".join(pages)


def log_site_body(site: Website, body: str) -> None:
    if not body:
        logger.info("No content cached for %s", site.url)
        return
    snippet = body[:200].replace("\n", " ")
    message = f"Cached snapshot for {site.url} ({len(body)} chars) snippet: {snippet}"
    logger.info(message)
    print(message)


def build_page_urls(site: Website) -> List[str]:
    config_data = site.pagination
    base_url = str(site.url)
    if not config_data:
        return [base_url]

    if isinstance(config_data, PaginationConfig):
        config = config_data
    elif isinstance(config_data, dict):
        try:
            config = PaginationConfig(**config_data)
        except ValidationError as exc:
            logger.warning("Invalid pagination config for %s: %s", site.id, exc)
            return [base_url]
    else:
        logger.warning("Unsupported pagination config type for %s: %s", site.id, type(config_data))
        return [base_url]

    pages = max(1, config.pages or 1)
    start = config.start or 1
    urls: List[str] = []
    for offset in range(pages):
        page_number = start + offset
        if config.strategy == "query" and config.parameter:
            urls.append(apply_query_pagination(base_url, config.parameter, page_number))
        elif config.strategy == "path" and config.template and "{page}" in config.template:
            urls.append(config.template.replace("{page}", str(page_number)))
        else:
            urls.append(base_url)
    logger.info("Pagination for %s yields %d urls", site.label, len(urls))
    return urls or [base_url]


def apply_query_pagination(base_url: str, parameter: str, page_number: int) -> str:
    parsed = urlparse(base_url)
    query = parse_qs(parsed.query, keep_blank_values=True)
    query[parameter] = [str(page_number)]
    new_query = urlencode(query, doseq=True)
    updated = parsed._replace(query=new_query)
    return urlunparse(updated)


def extract_candidate_entries(soup: BeautifulSoup, base_url: str) -> List[CandidateEntry]:
    entries: List[CandidateEntry] = []
    tags = soup.find_all(
        ["a", "h1", "h2", "h3", "h4", "h5", "h6", "strong", "em", "p", "li"]
    )
    for element in tags:
        text = element.get_text(" ", strip=True)
        norm = normalize_text(text)
        if not norm:
            continue
        href = element.get("href")
        link = urljoin(base_url, href) if href else None
        parent_text = (
            element.parent.get_text(" ", strip=True)
            if element.parent is not None
            else ""
        )
        context = parent_text if parent_text and parent_text != text else ""
        entries.append(
            {
                "text": text,
                "norm": norm,
                "tokens": norm.split(),
                "link": link,
                "context": context,
            }
        )
        if len(entries) >= MAX_CANDIDATE_ELEMENTS:
            break
    return entries


def locate_series_hit(
    candidates: List[CandidateEntry],
    title: str,
    site_url: str,
    detected_at: Optional[datetime] = None,
) -> Optional[Tuple[Optional[str], Optional[str], Optional[float], List[ChapterListing]]]:
    normalized_title = normalize_text(title)
    if not normalized_title:
        return None
    title_tokens = normalized_title.split()
    best: Tuple[float, Optional[str], Optional[str], Optional[float]] | None = None
    chapter_entries: List[ChapterListing] = []
    seen_chapter_keys: set[str] = set()
    for entry in candidates:
        candidate_norm = entry["norm"]
        tokens = entry["tokens"]
        if not is_structural_match(normalized_title, title_tokens, candidate_norm, tokens):
            continue
        ratio = SequenceMatcher(None, normalized_title, candidate_norm).ratio()
        chapter_label, chapter_number = extract_chapter_details(
            entry["text"], entry.get("context")
        )
        link = entry["link"] or site_url
        if chapter_label:
            key = build_chapter_signature(chapter_label, chapter_number)
            if key and key not in seen_chapter_keys:
                seen_chapter_keys.add(key)
                chapter_entries.append(
                    ChapterListing(
                        label=chapter_label,
                        number=chapter_number,
                        link=link,
                        detected_at=detected_at,
                    )
                )
        if best is None or ratio > best[0]:
            best = (ratio, link, chapter_label, chapter_number)
    if best is None:
        return None

    ordered = sort_chapter_entries(chapter_entries)
    if best[2]:
        signature = build_chapter_signature(best[2], best[3])
        if signature and signature not in {build_chapter_signature(item.label, item.number) for item in ordered}:
            ordered.insert(
                0,
                ChapterListing(
                    label=best[2],
                    number=best[3],
                    link=best[1],
                    detected_at=detected_at,
                ),
            )
    if not ordered:
        ordered = [
            ChapterListing(
                label=best[2],
                number=best[3],
                link=best[1],
                detected_at=detected_at,
            )
        ]
    return (best[1], best[2], best[3], ordered[:5])


def build_chapter_signature(label: Optional[str], number: Optional[float]) -> Optional[str]:
    if number is not None:
        return f"num:{number}"
    if label:
        return f"label:{label.strip().casefold()}"
    return None


def sort_chapter_entries(entries: List[ChapterListing]) -> List[ChapterListing]:
    if not entries:
        return []
    return sorted(
        entries,
        key=lambda item: (
            0 if item.number is not None else 1,
            -(item.number if item.number is not None else 0.0),
            item.label or "",
        ),
    )


def normalize_text(value: str) -> str:
    value = value.casefold()
    value = re.sub(r"[^a-z0-9\s]", " ", value)
    return " ".join(value.split())


def canonicalize_title(value: str) -> str:
    cleaned = normalize_text(value or "")
    return re.sub(r"\s+", "", cleaned)


def normalize_aliases(values: Iterable[str] | None) -> List[str]:
    result: List[str] = []
    if not values:
        return result
    seen: set[str] = set()
    for raw in values:
        if not isinstance(raw, str):
            continue
        candidate = raw.strip()
        if not candidate:
            continue
        token = canonicalize_title(candidate)
        if not token or token in seen:
            continue
        seen.add(token)
        result.append(candidate)
    return result


def series_tokens(title: str, aliases: Iterable[str] | None = None) -> set[str]:
    tokens: set[str] = set()
    values: List[str] = []
    if title:
        values.append(title)
    if aliases:
        values.extend(aliases)
    for value in values:
        token = canonicalize_title(value)
        if token:
            tokens.add(token)
    return tokens


def build_series_terms(records: Iterable[Series]) -> List[Dict[str, str]]:
    terms: List[Dict[str, str]] = []
    for record in records:
        display = record.title
        names = [record.title]
        if record.aliases:
            names.extend(record.aliases)
        for name in names:
            candidate = name.strip()
            if not candidate:
                continue
            canonical = canonicalize_title(candidate)
            if not canonical:
                continue
            terms.append({"display": display, "search": candidate, "canonical": canonical})
    return terms


def build_canonical_map(records: Iterable[Series]) -> Dict[str, str]:
    mapping: Dict[str, str] = {}
    for record in records:
        for token in series_tokens(record.title, record.aliases):
            if token and token not in mapping:
                mapping[token] = record.title
    return mapping


PROGRESS_KEYWORDS = {"chapter", "ch", "vol", "volume", "episode", "ep", "season"}


def contains_progress_keyword(tokens: List[str]) -> bool:
    for token in tokens:
        if token in PROGRESS_KEYWORDS:
            return True
        if token.isdigit():
            return True
    return False


def is_structural_match(
    normalized_title: str,
    title_tokens: List[str],
    candidate_norm: str,
    candidate_tokens: List[str],
) -> bool:
    if not candidate_norm:
        return False
    ratio = SequenceMatcher(None, normalized_title, candidate_norm).ratio()
    if ratio >= 0.9:
        return True

    token_set = set(candidate_tokens)
    title_set = set(title_tokens)
    if len(title_tokens) >= 2 and title_set.issubset(token_set) and ratio >= 0.75:
        return True

    if len(title_tokens) >= 2 and len(candidate_tokens) > len(title_tokens):
        prefix = candidate_tokens[: len(title_tokens)]
        remainder = candidate_tokens[len(title_tokens) :]
        if prefix == title_tokens and contains_progress_keyword(remainder):
            return True

    if len(title_tokens) == 1:
        title_token = title_tokens[0]
        if candidate_norm == title_token:
            return True
        if (
            candidate_tokens
            and candidate_tokens[0] == title_token
            and contains_progress_keyword(candidate_tokens[1:])
        ):
            return True
    return False


def collect_mock_matches(
    websites: List[Website], canonical_map: Dict[str, str]
) -> List[Match]:
    if not canonical_map:
        return []

    match_index: Dict[str, Dict[str, SourceHit]] = {}
    for site in websites:
        host = normalize_host(str(site.url))
        catalog = mock_catalogs.get(host)
        if not catalog:
            continue
        source_label = site.label or host
        for candidate in catalog:
            key = canonicalize_title(candidate)
            if key not in canonical_map:
                continue
            match_index.setdefault(canonical_map[key], {})[source_label] = SourceHit(
                site=source_label,
                link=str(site.url),
                latest_chapter=None,
                latest_chapter_number=None,
                recent_chapters=[],
                series_url_template=site.series_url_template,
                chapter_url_template=site.chapter_url_template,
                site_host=urlparse(str(site.url)).netloc.lower(),
            )
    return serialize_matches(match_index)


def serialize_matches(match_index: Dict[str, Dict[str, SourceHit]]) -> List[Match]:
    results: List[Match] = []
    for title, hits in match_index.items():
        ordered = sorted(
            hits.values(),
            key=lambda hit: (
                -(
                    hit.latest_chapter_number
                    if hit.latest_chapter_number is not None
                    else -1.0
                ),
                hit.site.lower(),
            ),
        )
        results.append(Match(title=title, sources=ordered))
    return results


def build_soup(html: str) -> Optional[BeautifulSoup]:
    try:
        return BeautifulSoup(html, "html.parser")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to parse HTML for metadata extraction: %s", exc)
        return None
def extract_chapter_details(
    primary: Optional[str], secondary: Optional[str] = None
) -> Tuple[Optional[str], Optional[float]]:
    for snippet in (primary, secondary):
        if not snippet:
            continue
        label, number = detect_chapter_in_snippet(snippet)
        if label:
            return (label, number)
    return (None, None)


def detect_chapter_in_snippet(snippet: str) -> Tuple[Optional[str], Optional[float]]:
    match = CHAPTER_REGEX.search(snippet)
    if match:
        label = match.group(1).strip()
        return (label, try_parse_number(label))

    tokens = normalize_text(snippet).split()
    if contains_progress_keyword(tokens):
        digits = re.search(r"(\d+(?:\.\d+)?)", snippet)
        if digits:
            label = digits.group(1)
            return (label, try_parse_number(label))
    return (None, None)


def try_parse_number(value: str) -> Optional[float]:
    try:
        return float(value)
    except ValueError:
        return None


def normalize_host(value: str) -> str:
    try:
        host = urlparse(value).hostname or value
    except ValueError:
        host = value
    host = host.lower()
    return host[4:] if host.startswith("www.") else host


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
