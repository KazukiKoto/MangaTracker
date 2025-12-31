import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
const AUTO_REFRESH_INTERVAL_MS = 60_000;

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

const tokenToNumber = (token) => {
  if (!token || typeof token !== "string") {
    return null;
  }
  if (token.startsWith("num:")) {
    const value = Number(token.slice(4));
    return Number.isFinite(value) ? value : null;
  }
  return null;
};

const getLatestChapterNumber = (primaryChapter, source) => {
  if (primaryChapter?.number != null) {
    return primaryChapter.number;
  }
  if (primaryChapter?.label) {
    const parsed = coerceChapterNumber(primaryChapter.label);
    if (parsed != null) {
      return parsed;
    }
  }
  if (source?.latest_chapter_number != null) {
    return source.latest_chapter_number;
  }
  if (source?.latest_chapter) {
    const parsed = coerceChapterNumber(source.latest_chapter);
    if (parsed != null) {
      return parsed;
    }
  }
  return null;
};

const buildSyntheticChapterEntry = (seriesTitle, source, overrides = {}, number) => {
  if (!source || number == null) {
    return null;
  }
  const numeric = Number(number);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  const slug = slugifyTitle(seriesTitle);
  const host = getSiteHost(source);
  const handle = resolveSeriesHandle(host, overrides) || slug;
  const sourceLink = typeof source.link === "string" ? source.link.trim() : "";
  const baseContext = {
    title: seriesTitle ?? "",
    slug,
    handle,
    base_url: sourceLink,
  };
  const templateLink = applyTemplatePlaceholders(source.chapter_url_template, {
    ...baseContext,
    chapter: String(numeric),
    chapter_label: String(numeric),
    chapter_number: String(numeric),
  });
  const label = `Chapter ${numeric}`;
  return {
    label,
    number: numeric,
    link: templateLink || sourceLink || null,
    token: buildChapterTokenFromParts(label, numeric),
    detectedAt: null,
  };
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
  const sourceLink = typeof source.link === "string" ? source.link.trim() : "";
  const baseContext = {
    title: seriesTitle ?? "",
    slug,
    handle,
    base_url: sourceLink,
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
    const rawLink = typeof item.link === "string" ? item.link.trim() : "";
    const effectiveItemLink = rawLink && (!sourceLink || rawLink !== sourceLink) ? rawLink : "";
    entries.push({
      label: label ?? (numericValue != null ? `Chapter ${numericValue}` : "Unknown"),
      number: numericValue,
      link: effectiveItemLink || templateLink || sourceLink || null,
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
  const [tags, setTags] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshingMatches, setRefreshingMatches] = useState(false);
  const [error, setError] = useState("");
  const autoRefreshTimerRef = useRef(null);

  const hydrate = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [siteData, seriesData, tagData, matchData] = await Promise.all([
        request("/api/sites"),
        request("/api/series"),
        request("/api/tags"),
        request("/api/matches"),
      ]);
      setWebsites(siteData);
      setSeries(seriesData);
      setTags(tagData);
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

  const refreshMatches = useCallback(async () => {
    try {
      setRefreshingMatches(true);
      setError("");
      const updatedMatches = await request("/api/matches");
      setMatches(updatedMatches);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to refresh matches";
      setError(message);
      throw err;
    } finally {
      setRefreshingMatches(false);
    }
  }, []);

  const queueAutoRefresh = useCallback(() => {
    if (autoRefreshTimerRef.current) {
      clearTimeout(autoRefreshTimerRef.current);
      autoRefreshTimerRef.current = null;
    }
    if (typeof window === "undefined") {
      return;
    }
    autoRefreshTimerRef.current = window.setTimeout(() => {
      refreshMatches().catch((err) => console.error("Auto refresh failed", err));
    }, AUTO_REFRESH_INTERVAL_MS);
  }, [refreshMatches]);

  useEffect(() => {
    if (autoRefreshTimerRef.current) {
      clearTimeout(autoRefreshTimerRef.current);
      autoRefreshTimerRef.current = null;
    }
    if (!loading && !refreshingMatches) {
      queueAutoRefresh();
    }
    return () => {
      if (autoRefreshTimerRef.current) {
        clearTimeout(autoRefreshTimerRef.current);
        autoRefreshTimerRef.current = null;
      }
    };
  }, [loading, refreshingMatches, queueAutoRefresh]);

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

  const readTokens = useMemo(() => {
    const map = {};
    series.forEach((record) => {
      if (!record?.title) {
        return;
      }
      const key = record.title.trim().toLowerCase();
      if (key && record.last_read_token) {
        map[key] = record.last_read_token;
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

  const reauthenticateSite = useCallback(
    async (siteId, options = {}) => {
      try {
        setError("");
        const response = await request(`/api/sites/${siteId}/reauth`, { method: "POST", body: options });
        await hydrate();
        return response;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to refresh authentication";
        setError(message);
        throw err;
      }
    },
    [hydrate]
  );

  const addTag = useCallback(
    async (payload) => {
      try {
        setError("");
        const created = await request("/api/tags", { method: "POST", body: payload });
        setTags((prev) => [...prev, created]);
        return created;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to add tag";
        setError(message);
        throw err;
      }
    },
    []
  );

  const updateTag = useCallback(
    async (tagId, payload) => {
      try {
        setError("");
        await request(`/api/tags/${tagId}`, { method: "PUT", body: payload });
        await hydrate();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to update tag";
        setError(message);
        throw err;
      }
    },
    [hydrate]
  );

  const removeTag = useCallback(
    async (tagId) => {
      try {
        setError("");
        await request(`/api/tags/${tagId}`, { method: "DELETE" });
        await hydrate();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to remove tag";
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
      const lastReadToken = key ? readTokens[key] : null;
      const lastReadNumber = tokenToNumber(lastReadToken);
      const latestChapterNumber = getLatestChapterNumber(primaryChapter, latestSource);
      const highestChapterNumber = latestChapterNumber != null ? Math.round(latestChapterNumber) : null;
      const lastReadRounded = lastReadNumber != null ? Math.round(lastReadNumber) : null;
      const numericUnreadDiff =
        highestChapterNumber != null && lastReadRounded != null
          ? Math.max(0, highestChapterNumber - lastReadRounded)
          : null;
      let unreadChapters = deriveUnreadChapters(chapterEntries, lastReadToken);
      if (!unreadChapters.length && chapterToken && chapterToken !== lastReadToken && primaryChapter) {
        unreadChapters = [primaryChapter];
      }
      if (
        numericUnreadDiff &&
        numericUnreadDiff > unreadChapters.length &&
        latestSource &&
        highestChapterNumber != null &&
        lastReadRounded != null
      ) {
        const seenTokens = new Set(unreadChapters.map((entry) => entry.token).filter(Boolean));
        let candidateNumber = highestChapterNumber;
        while (unreadChapters.length < numericUnreadDiff && candidateNumber > lastReadRounded) {
          const synthetic = buildSyntheticChapterEntry(match.title, latestSource, siteOverrides, candidateNumber);
          if (synthetic?.token && !seenTokens.has(synthetic.token)) {
            unreadChapters.push(synthetic);
            seenTokens.add(synthetic.token);
          }
          candidateNumber -= 1;
        }
        unreadChapters.sort((a, b) => (b.number ?? 0) - (a.number ?? 0));
      }
      const isUnread = unreadChapters.length > 0;
      const seriesLink = buildSeriesLink(match.title, latestSource, siteOverrides);
      const unreadCount =
        numericUnreadDiff != null ? Math.max(numericUnreadDiff, unreadChapters.length) : unreadChapters.length;
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
        unreadCount,
      };
    });
  }, [matches, readTokens, seriesLookup]);

  const unreadMatches = useMemo(() => {
    const unreadEntries = matchSummaries.filter((entry) => entry.unreadChapters.length && entry.chapterToken);
    return unreadEntries.sort((a, b) => {
      const latestA = entryMostRecentTimestamp(a);
      const latestB = entryMostRecentTimestamp(b);
      return latestB - latestA;
    });
  }, [matchSummaries]);

  const markChaptersRead = useCallback(
    async (entries) => {
      if (!entries.length) {
        return;
      }
      const pending = new Map();
      entries.forEach(({ title, token }) => {
        if (!title || !token) {
          return;
        }
        const key = title.trim().toLowerCase();
        if (!key) {
          return;
        }
        const record = seriesLookup.get(key);
        if (!record) {
          return;
        }
        if (record.last_read_token === token) {
          return;
        }
        pending.set(record.id, token);
      });
      if (!pending.size) {
        return;
      }
      try {
        const updates = await Promise.all(
          Array.from(pending.entries()).map(([seriesId, token]) =>
            request(`/api/series/${seriesId}`, { method: "PUT", body: { last_read_token: token } })
          )
        );
        setSeries((prev) => {
          const replacements = new Map(updates.map((record) => [record.id, record]));
          return prev.map((record) => replacements.get(record.id) ?? record);
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to update reading progress";
        setError(message);
        throw err;
      }
    },
    [seriesLookup, setSeries, setError]
  );

  const markChapterRead = useCallback(
    (title, token) => {
      if (!title || !token) return;
      markChaptersRead([{ title, token }]).catch((err) => console.error(err));
    },
    [markChaptersRead]
  );

  const contextValue = useMemo(
    () => ({
      data: { websites, series, matches, matchSummaries, unreadMatches, tags },
      status: { loading, error, refreshingMatches },
      actions: {
        hydrate,
        refreshMatches,
        addSite,
        updateSite,
        removeSite,
        reauthenticateSite,
        addTag,
        updateTag,
        removeTag,
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
      tags,
      matchSummaries,
      unreadMatches,
      loading,
      refreshingMatches,
      error,
      hydrate,
      refreshMatches,
      addSite,
      updateSite,
      removeSite,
      reauthenticateSite,
      addTag,
      updateTag,
      removeTag,
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
