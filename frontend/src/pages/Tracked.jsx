import Panel from "../components/Panel";
import { useTracker } from "../context/TrackerContext";

const TrackedPage = () => {
  const {
    data: { websites, series, matchSummaries },
    status: { loading },
    actions: { refreshMatches },
  } = useTracker();

  const canShowMatches = Boolean(websites.length && series.length);
  const matchesEmptyCopy = canShowMatches
    ? "No overlaps yet—snapshots refresh every minute, or tap Refresh to check again."
    : "Add at least one site and one series to surface overlaps.";

  const handleRefresh = () => {
    refreshMatches().catch((err) => console.error(err));
  };

  return (
    <div className="flex flex-col gap-8">
      <Panel title="Reading List">
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            {matchSummaries.length} match{matchSummaries.length === 1 ? "" : "es"} across {websites.length} site
            {websites.length === 1 ? "" : "s"}.
          </p>
          <button
            className="text-xs font-semibold uppercase tracking-wide text-glow"
            onClick={handleRefresh}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
        {loading ? (
          <div className="rounded-xl border border-slate-100 bg-white/70 px-4 py-6 text-center text-sm text-slate-500">
            Loading tracker data…
          </div>
        ) : matchSummaries.length ? (
          <ul className="flex flex-col gap-2">
            {matchSummaries.map((entry) => {
              const siteLabel = entry.latestSource?.site;
              const link = entry.latestSource?.link;
              const chapterLabel = entry.chapterLabel ?? "Unknown";
              return (
                <li
                  key={`${entry.title}-${entry.chapterToken ?? "na"}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white/70 px-4 py-2 text-sm"
                >
                  <p className="text-sm text-ink">
                    <span className="font-semibold">{entry.title}</span>
                    <span className="text-slate-500">
                      {" "}• Chapter {chapterLabel}
                      {siteLabel ? ` • ${siteLabel}` : ""}
                    </span>
                  </p>
                  {link && (
                    <a
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold uppercase tracking-wide text-glow hover:underline"
                    >
                      Open
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
            {matchesEmptyCopy}
          </div>
        )}
      </Panel>
    </div>
  );
};

export default TrackedPage;
