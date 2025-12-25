import Panel from "../components/Panel";
import SeriesCard from "../components/SeriesCard";
import { useTracker } from "../context/TrackerContext";

const TrackedPage = () => {
  const {
    data: { websites, series, matches },
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
      <Panel
        title="Tracked Manga"
        copy="Live overlaps between your whitelist and every tracked source"
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            {matches.length} match{matches.length === 1 ? "" : "es"} across {websites.length} site
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
        ) : matches.length ? (
          <ul className="flex flex-col gap-4">
            {matches.map((match) => (
              <SeriesCard key={match.title} match={match} />
            ))}
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
