import { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import DashboardPage from "./pages/Dashboard";
import WebsitesPage from "./pages/Websites";
import SeriesPage from "./pages/Series";
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

  const contextValue = useMemo(
    () => ({
      data: { websites, series, matches },
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
      },
    }),
    [
      websites,
      series,
      matches,
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
    ]
  );

  return (
    <BrowserRouter>
      <TrackerContext.Provider value={contextValue}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="/websites" element={<WebsitesPage />} />
            <Route path="/series" element={<SeriesPage />} />
          </Route>
        </Routes>
      </TrackerContext.Provider>
    </BrowserRouter>
  );
}

export default App;
