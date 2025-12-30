import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useTracker } from "../context/TrackerContext";
import ThemeToggle from "./ThemeToggle";

const links = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/tracked", label: "Reading List" },
  { to: "/websites", label: "Tracked Websites" },
  { to: "/series", label: "Tracked Manga" },
];

const THEME_STORAGE_KEY = "manga-tracker:theme";

const getInitialTheme = () => {
  if (typeof window === "undefined") {
    return "dark";
  }
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
};

const Layout = () => {
  const {
    status: { error },
  } = useTracker();
  const [theme, setTheme] = useState(() => getInitialTheme());

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    if (!root) return;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#08101c] text-slate-900 dark:bg-[#03050c] dark:text-slate-100">
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        <div className="h-full w-full bg-[radial-gradient(circle_at_30%_40%,rgba(34,211,238,0.35),transparent_55%),radial-gradient(circle_at_80%_20%,rgba(59,130,246,0.25),transparent_50%),linear-gradient(135deg,#030712,#0f172a)] dark:bg-[radial-gradient(circle_at_35%_45%,rgba(14,165,233,0.35),transparent_55%),radial-gradient(circle_at_75%_25%,rgba(14,116,144,0.3),transparent_50%),linear-gradient(145deg,#010104,#050a19)]" />
      </div>
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 pb-16 pt-10 sm:px-6 lg:px-0">
        <header className="flex flex-col gap-5 text-white drop-shadow-2xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="uppercase tracking-[0.35em] text-xs text-white/70">Reading companion</p>
              <h1 className="mt-3 text-4xl font-semibold leading-[1.1] sm:text-5xl lg:text-6xl">
              Manga Tracker
              </h1>
              <p className="mt-4 max-w-2xl text-lg text-white/90">
                Manage the sources you trust, curate your reading list, and keep tabs on the latest chapters across every site.
              </p>
            </div>
            <ThemeToggle theme={theme} onToggle={setTheme} />
          </div>
          <nav className="flex flex-wrap justify-center gap-3 text-sm sm:justify-start">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `rounded-full border px-4 py-2 font-semibold transition ${
                    isActive
                      ? "border-white/70 bg-white/90 text-ink"
                      : "border-white/30 bg-white/10 text-white/80 hover:border-white/60"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </header>
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
            {error}
          </div>
        )}
        <Outlet />
      </div>
    </div>
  );
};

export default Layout;
