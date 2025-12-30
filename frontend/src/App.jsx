import { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import DashboardPage from "./pages/Dashboard";
import WebsitesPage from "./pages/Websites";
import SeriesPage from "./pages/Series";
import TrackedPage from "./pages/Tracked";
import { TrackerContext } from "./context/TrackerContext";

const deriveApiBase = () => {
  if (import.meta.env.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE;
  }
  if (typeof window === "undefined" || !window.location) {
    return "http://localhost:8000";
  }
  const { protocol, hostname, port } = window.location;
  const apiPort = !port || port === "5173" ? "8000" : port;
  return `${protocol}//${hostname}${apiPort ? `:${apiPort}` : ""}`;
};

const API_BASE = deriveApiBase();
const READ_STORAGE_KEY = "manga-tracker:last-read";

const loadReadChapters = () => {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(READ_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const persistReadChapters = (payload) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore storage errors */
  }
};

const selectLatestSource = (match) => {
  if (!match || !Array.isArray(match.sources) || !match.sources.length) {
    return null;
  }
  const ordered = [...match.sources].sort((a, b) => {
    const left = a.latest_chapter_number ?? -1;
    const right = b.latest_chapter_number ?? -1;
    if (left !== right) {
      return right - left;
    }
    return (b.latest_chapter || "").localeCompare(a.latest_chapter || "");
  });
  const numeric = ordered.find((source) => typeof source.latest_chapter_number === "number");
  if (numeric) {
    return numeric;
  }
  return ordered[0];
};

const formatChapterLabel = (source) => {
  if (!source) {
    return "Unknown";
  }
  if (source.latest_chapter) {
    return source.latest_chapter;
  }
  if (source.latest_chapter_number != null) {
    return String(source.latest_chapter_number);
  }
  return "Unknown";
};

const coerceChapterNumber = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const buildChapterTokenFromParts = (label, number) => {
  const numericValue = coerceChapterNumber(number);
  if (numericValue != null) {
    return `num:${numericValue}`;
  }
  if (label) {
    return `label:${String(label).trim().toLowerCase()}`;
  }
  return null;
};

const buildChapterToken = (source) => {
  if (!source) {
    return null;
  }
  return buildChapterTokenFromParts(source.latest_chapter, source.latest_chapter_number);
};

const slugifyTitle = (value) => {
  if (!value) {
    return "";
  }
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const applyTemplatePlaceholders = (template, replacements = {}) => {
  if (!template) {
    return null;
  }
  let output = template;
  Object.entries(replacements).forEach(([key, rawValue]) => {
    const safeValue = rawValue ?? "";
    const pattern = new RegExp(`\\{${key}\\}`, "gi");
    output = output.replace(pattern, safeValue);
  });
  const trimmed = output.trim();
  return trimmed || null;
};

const getSiteHost = (source) => {
  if (!source) {
    return "";
  }
  if (source.site_host) {
    return source.site_host;
  }
  if (source.link) {
    try {
      return new URL(source.link).host.toLowerCase();
    } catch {
      return "";
    }
  }
  return "";
};

const resolveSeriesHandle = (host, overrides = {}) => {
  if (!host || !overrides) {
    return "";
  }
  return overrides[host] ?? "";
};

const buildSeriesLink = (seriesTitle, source, overrides = {}) => {
  if (!source) {
    return null;
  }
  const slug = slugifyTitle(seriesTitle);
  const host = getSiteHost(source);
  const handle = resolveSeriesHandle(host, overrides) || slug;
  const context = {
    title: seriesTitle ?? "",
    slug,
    handle,
    base_url: source.link ?? "",
  };
  const templated = applyTemplatePlaceholders(source.series_url_template, context);
  if (templated) {
    return templated;
  }
  return source.link || null;
};

const buildChapterEntries = (seriesTitle, source, overrides = {}) => {
  if (!source) {
    return [];
  }
  const slug = slugifyTitle(seriesTitle);
  const host = getSiteHost(source);
  const handle = resolveSeriesHandle(host, overrides) || slug;
  const baseContext = {
    title: seriesTitle ?? "",
    slug,
    handle,
    base_url: source.link ?? "",
  };
  const rawEntries = Array.isArray(source.recent_chapters) && source.recent_chapters.length
    ? source.recent_chapters
    : [
        {
          label: source.latest_chapter,
          number: source.latest_chapter_number,
          link: source.link,
        },
      ];
  const seen = new Set();
  const entries = [];
  rawEntries.forEach((item) => {
    if (!item) {
      return;
    }
    const numericValue = coerceChapterNumber(item.number ?? item.label);
    const label = item.label ?? (numericValue != null ? String(numericValue) : null);
    if (!label && numericValue == null) {
      return;
    }
    const token = buildChapterTokenFromParts(label, numericValue);
    if (token && seen.has(token)) {
      return;
    }
    if (token) {
      seen.add(token);
    }
    const templateLink = applyTemplatePlaceholders(source.chapter_url_template, {
      ...baseContext,
      chapter: numericValue != null ? String(numericValue) : label ?? "",
      chapter_label: label ?? "",
      chapter_number: numericValue != null ? String(numericValue) : "",
    });
    entries.push({
      label: label ?? (numericValue != null ? `Chapter ${numericValue}` : "Unknown"),
      number: numericValue,
      link: item.link || templateLink || source.link || null,
      token,
      detectedAt: item.detected_at ?? null,
    });
  });
  return entries;
};

const getDetectionTimestamp = (value) => {
  if (!value) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const entryMostRecentTimestamp = (entry) => {
  const headChapter = entry?.unreadChapters?.[0];
  if (headChapter) {
    return getDetectionTimestamp(headChapter.detectedAt);
  }
  if (entry?.chapters?.length) {
    return getDetectionTimestamp(entry.chapters[0].detectedAt);
  }
  return 0;
};

const deriveUnreadChapters = (entries, lastReadToken) => {
  if (!entries.length) {
    return [];
  }
  if (!lastReadToken) {
    return entries
      .filter((entry) => entry.token)
      .sort((a, b) => getDetectionTimestamp(b.detectedAt) - getDetectionTimestamp(a.detectedAt));
  }
  const unread = [];
  for (const entry of entries) {
    if (!entry.token) {
      continue;
    }
    if (entry.token === lastReadToken) {
      break;
    }
    unread.push(entry);
  }
  return unread.sort((a, b) => getDetectionTimestamp(b.detectedAt) - getDetectionTimestamp(a.detectedAt));
};

const request = async (path, options = {}) => {
  const config = {
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    ...options,
  };

  if (config.body && typeof config.body !== "string") {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(`${API_BASE}${path}`, config);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
};

function App() {
  const [websites, setWebsites] = useState([]);
  const [series, setSeries] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [readChapters, setReadChapters] = useState(() => loadReadChapters());

  const hydrate = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [siteData, seriesData, matchData] = await Promise.all([
        request("/api/sites"),
        request("/api/series"),
        request("/api/matches"),
      ]);
      setWebsites(siteData);
      setSeries(seriesData);
      setMatches(matchData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    persistReadChapters(readChapters);
  }, [readChapters]);

  const refreshMatches = useCallback(async () => {
    try {
      setError("");
      const updatedMatches = await request("/api/matches");
      setMatches(updatedMatches);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to refresh matches";
      setError(message);
      throw err;
    }
  }, []);

  const seriesLookup = useMemo(() => {
    const map = new Map();
    series.forEach((record) => {
      if (!record?.title) {
        return;
      }
      const key = record.title.trim().toLowerCase();
      if (key) {
        map.set(key, record);
      }
    });
    return map;
  }, [series]);

  const addSite = useCallback(
    async (payload) => {
      try {
        setError("");
        await request("/api/sites", { method: "POST", body: payload });
        await hydrate();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to add website";
        setError(message);
        throw err;
      }
    },
    [hydrate]
  );

  const updateSite = useCallback(
    async (siteId, payload) => {
      try {
        setError("");
        await request(`/api/sites/${siteId}`, { method: "PUT", body: payload });
        await hydrate();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to update website";
        setError(message);
        throw err;
      }
    },
    [hydrate]
  );

  const removeSite = useCallback(
    async (siteId) => {
      try {
        setError("");
        await request(`/api/sites/${siteId}`, { method: "DELETE" });
        await hydrate();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to remove website";
        setError(message);
        throw err;
      }
    },
    [hydrate]
  );

  const addSeries = useCallback(
    async (payload) => {
      try {
        setError("");
        await request("/api/series", { method: "POST", body: payload });
        await hydrate();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to add series";
        setError(message);
        throw err;
      }
    },
    [hydrate]
  );

  const updateSeries = useCallback(
    async (seriesId, payload) => {
      try {
        setError("");
        await request(`/api/series/${seriesId}`, { method: "PUT", body: payload });
        await hydrate();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to update series";
        setError(message);
        throw err;
      }
    },
    [hydrate]
  );

  const removeSeries = useCallback(
    async (seriesId) => {
      try {
        setError("");
        await request(`/api/series/${seriesId}`, { method: "DELETE" });
        await hydrate();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to remove series";
        setError(message);
        throw err;
      }
    },
    [hydrate]
  );

  const matchSummaries = useMemo(() => {
    return matches.map((match) => {
      const latestSource = selectLatestSource(match);
      const normalizedTitle = match.title.trim().toLowerCase();
      const seriesRecord = seriesLookup.get(normalizedTitle);
      const siteOverrides = seriesRecord?.site_overrides ?? {};
      const chapterEntries = buildChapterEntries(match.title, latestSource, siteOverrides);
      const primaryChapter = chapterEntries[0] ?? null;
      const chapterToken = primaryChapter?.token ?? buildChapterToken(latestSource);
      const chapterLabel = primaryChapter?.label ?? formatChapterLabel(latestSource);
      const key = match.title.trim().toLowerCase();
      const lastReadToken = key ? readChapters[key] : null;
      let unreadChapters = deriveUnreadChapters(chapterEntries, lastReadToken);
      if (!unreadChapters.length && chapterToken && chapterToken !== lastReadToken && primaryChapter) {
        unreadChapters = [primaryChapter];
      }
      const isUnread = unreadChapters.length > 0;
      const seriesLink = buildSeriesLink(match.title, latestSource, siteOverrides);
      return {
        match,
        title: match.title,
        latestSource,
        seriesLink,
        chapterLabel,
        chapterToken,
        isUnread,
        chapters: chapterEntries,
        unreadChapters,
        unreadCount: unreadChapters.length,
      };
    });
  }, [matches, readChapters, seriesLookup]);

  const unreadMatches = useMemo(() => {
    const unreadEntries = matchSummaries.filter((entry) => entry.unreadChapters.length && entry.chapterToken);
    return unreadEntries.sort((a, b) => {
      const latestA = entryMostRecentTimestamp(a);
      const latestB = entryMostRecentTimestamp(b);
      return latestB - latestA;
    });
  }, [matchSummaries]);

  const markChaptersRead = useCallback((entries) => {
    if (!entries.length) {
      return;
    }
    setReadChapters((prev) => {
      const next = { ...prev };
      let changed = false;
      entries.forEach(({ title, token }) => {
        if (!title || !token) {
          return;
        }
        const key = title.trim().toLowerCase();
        if (!key) {
          return;
        }
        if (next[key] !== token) {
          next[key] = token;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, []);

  const markChapterRead = useCallback(
    (title, token) => {
      if (!title || !token) return;
      markChaptersRead([{ title, token }]);
    },
    [markChaptersRead]
  );

  const contextValue = useMemo(
    () => ({
      data: { websites, series, matches, matchSummaries, unreadMatches },
      status: { loading, error },
      actions: {
        hydrate,
        refreshMatches,
        addSite,
        updateSite,
        removeSite,
        addSeries,
        updateSeries,
        removeSeries,
        markChapterRead,
        markChaptersRead,
      },
    }),
    [
      websites,
      series,
      matches,
      matchSummaries,
      unreadMatches,
      loading,
      error,
      hydrate,
      refreshMatches,
      addSite,
      updateSite,
      removeSite,
      addSeries,
      updateSeries,
      removeSeries,
      markChapterRead,
      markChaptersRead,
    ]
  );

  return (
    <BrowserRouter>
      <TrackerContext.Provider value={contextValue}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="/tracked" element={<TrackedPage />} />
            <Route path="/websites" element={<WebsitesPage />} />
            <Route path="/series" element={<SeriesPage />} />
          </Route>
        </Routes>
      </TrackerContext.Provider>
    </BrowserRouter>
  );
}

export default App;
