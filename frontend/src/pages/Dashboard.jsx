import Panel from "../components/Panel";
import SeriesCard from "../components/SeriesCard";
import { useTracker } from "../context/TrackerContext";

const DashboardPage = () => {
  const {
    data: { websites, series, matches },
    status: { loading },
    actions: { refreshMatches },
  } = useTracker();

  const canShowMatches = Boolean(websites.length && series.length);
  const matchesEmptyCopy = canShowMatches
    ? "No overlaps yet—snapshots refresh every minute, or hit Refresh to check again."
    : "Add at least one site and one series to surface overlaps.";
  const handleRefresh = () => {
    refreshMatches().catch((err) => console.error(err));
  };

  return (
    <div className="flex flex-col gap-8">
      <Panel title="Snapshot" copy="Quick stats from the current tracker state">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-100 bg-white/80 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Websites</p>
            <p className="text-3xl font-semibold text-ink">{websites.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white/80 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Series</p>
            <p className="text-3xl font-semibold text-ink">{series.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white/80 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Matches</p>
            <p className="text-3xl font-semibold text-ink">{matches.length}</p>
          </div>
        </div>
      </Panel>

      <Panel
        title="Now Reading"
        copy="Matches between your whitelist and tracked sites"
        className="md:col-span-2"
      >
        <div className="mb-4 flex justify-end">
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

export default DashboardPage;
