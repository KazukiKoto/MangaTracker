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

const buildChapterToken = (source) => {
  if (!source) {
    return null;
  }
  if (source.latest_chapter_number != null) {
    return `num:${source.latest_chapter_number}`;
  }
  if (source.latest_chapter) {
    return `label:${source.latest_chapter.toLowerCase()}`;
  }
  return null;
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
      const chapterToken = buildChapterToken(latestSource);
      const chapterLabel = formatChapterLabel(latestSource);
      const key = match.title.trim().toLowerCase();
      const lastReadToken = key ? readChapters[key] : null;
      const isUnread = Boolean(chapterToken && chapterToken !== lastReadToken);
      return {
        match,
        title: match.title,
        latestSource,
        chapterLabel,
        chapterToken,
        isUnread,
      };
    });
  }, [matches, readChapters]);

  const unreadMatches = useMemo(
    () => matchSummaries.filter((entry) => entry.isUnread && entry.chapterToken),
    [matchSummaries]
  );

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
