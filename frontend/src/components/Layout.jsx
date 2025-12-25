import { NavLink, Outlet } from "react-router-dom";
import { useTracker } from "../context/TrackerContext";

const links = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/websites", label: "Tracked Websites" },
  { to: "/series", label: "Reading List" },
];

const Layout = () => {
  const {
    status: { error },
  } = useTracker();

  return (
    <div className="relative min-h-screen text-slate-900">
      <div className="pointer-events-none absolute inset-0 opacity-60" aria-hidden>
        <div className="h-full w-full bg-[radial-gradient(circle_at_25%_25%,rgba(255,255,255,0.08),transparent_45%)]" />
      </div>
      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-16 pt-10 sm:px-6 lg:px-0">
        <header className="flex flex-col gap-5 text-white drop-shadow-2xl">
          <div>
            <p className="uppercase tracking-[0.35em] text-xs text-white/70">Reading queue companion</p>
            <h1 className="mt-3 text-4xl font-semibold leading-[1.1] sm:text-5xl lg:text-6xl">
              Manga Tracker
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-white/90">
              Manage the sources you trust, curate your reading whitelist, and keep tabs on the latest chapters across every site.
            </p>
          </div>
          <nav className="flex flex-wrap gap-3 text-sm">
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
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}
        <Outlet />
      </div>
    </div>
  );
};

export default Layout;
