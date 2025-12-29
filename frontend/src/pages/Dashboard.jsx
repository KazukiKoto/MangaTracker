import { useMemo, useState } from "react";
import Panel from "../components/Panel";
import { useTracker } from "../context/TrackerContext";

const TAB_OPTIONS = [
  { id: "unread", label: "Unread" },
  { id: "all", label: "All tracked" },
];

const DashboardPage = () => {
  const {
    data: { websites, series, matches, unreadMatches, matchSummaries },
    status: { loading },
    actions: { refreshMatches, markChapterRead, markChaptersRead },
  } = useTracker();
  const [activeTab, setActiveTab] = useState("unread");

  const visibleEntries = useMemo(
    () => (activeTab === "unread" ? unreadMatches : matchSummaries),
    [activeTab, unreadMatches, matchSummaries]
  );

  const refresh = () => {
    refreshMatches().catch((err) => console.error(err));
  };

  const markEntryRead = (entry) => {
    if (!entry.chapterToken) return;
    markChapterRead(entry.title, entry.chapterToken);
  };

  const markVisibleAsRead = () => {
    const targets = (activeTab === "unread" ? unreadMatches : matchSummaries).filter(
      (entry) => entry.isUnread && entry.chapterToken
    );
    if (!targets.length) return;
    markChaptersRead(targets.map(({ title, chapterToken }) => ({ title, token: chapterToken })));
  };

  const emptyCopy = activeTab === "unread"
    ? "You are up to date on every tracked series."
    : "No tracked overlaps found — refresh to check again.";

  return (
    <div className="flex flex-col gap-8">
      <Panel title="Tracked">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-100 bg-white/80 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Websites</p>
            <p className="text-3xl font-semibold text-ink">{websites.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white/80 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Series</p>
            <p className="text-3xl font-semibold text-ink">{series.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white/80 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Tracked manga</p>
            <p className="text-3xl font-semibold text-ink">{matches.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white/80 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Unread chapters</p>
            <p className="text-3xl font-semibold text-ink">{unreadMatches.length}</p>
          </div>
        </div>
      </Panel>

      <Panel title="Unread Chapters" className="md:col-span-2">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-full border border-white/60 bg-white/70 p-1 text-sm">
            {TAB_OPTIONS.map((tab) => (
              <button
                key={tab.id}
                className={`rounded-full px-4 py-1 font-semibold transition ${
                  activeTab === tab.id ? "bg-ink text-white" : "text-slate-600"
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:border-slate-500"
              onClick={refresh}
              disabled={loading}
            >
              Refresh
            </button>
            <button
              className="rounded-full border border-glow/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-glow hover:border-glow"
              onClick={markVisibleAsRead}
              disabled={!unreadMatches.length}
            >
              Mark all read
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border border-slate-100 bg-white/70 px-4 py-6 text-center text-sm text-slate-500">
            Loading tracker data…
          </div>
        ) : visibleEntries.length ? (
          <ul className="flex flex-col gap-3">
            {visibleEntries.map((entry) => (
              <li
                key={`${entry.title}-${entry.chapterToken ?? "na"}`}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white/80 px-4 py-3"
              >
                <div>
                  <p className="text-base font-semibold text-ink">{entry.title}</p>
                  <p className="text-xs text-slate-500">
                    Latest chapter {entry.chapterLabel}
                    {entry.latestSource?.site ? ` • ${entry.latestSource.site}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                      entry.isUnread ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {entry.isUnread ? "Unread" : "Read"}
                  </span>
                  <button
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:border-slate-500 disabled:opacity-40"
                    onClick={() => markEntryRead(entry)}
                    disabled={!entry.isUnread || !entry.chapterToken}
                  >
                    Mark read
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
            {emptyCopy}
          </div>
        )}
      </Panel>
    </div>
  );
};

export default DashboardPage;
