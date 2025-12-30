import { useMemo, useState } from "react";
import Panel from "../components/Panel";
import { useTracker } from "../context/TrackerContext";
import { formatDetectionAge } from "../utils/time";
import useRelativeNow from "../hooks/useRelativeNow";

const TAB_OPTIONS = [
  { id: "unread", label: "Unread" },
  { id: "all", label: "All tracked" },
];

const ArrowToggleIcon = ({ expanded }) => (
  <svg
    aria-hidden
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-slate-600 dark:text-slate-200"
  >
    <path d={expanded ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} />
  </svg>
);

const DashboardPage = () => {
  const {
    data: { websites, series, matches, unreadMatches, matchSummaries },
    status: { loading, refreshingMatches },
    actions: { refreshMatches, markChapterRead, markChaptersRead },
  } = useTracker();
  const [activeTab, setActiveTab] = useState("unread");
  const [expandedTitles, setExpandedTitles] = useState(() => new Set());
  const relativeNow = useRelativeNow();

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

  const toggleExpanded = (title) => {
    setExpandedTitles((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  };

  const isExpanded = (title) => expandedTitles.has(title);

  return (
    <div className="flex flex-col gap-8">
      <Panel title="Tracked">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-100 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Websites</p>
            <p className="text-3xl font-semibold text-ink dark:text-white">{websites.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Series</p>
            <p className="text-3xl font-semibold text-ink dark:text-white">{series.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Tracked manga</p>
            <p className="text-3xl font-semibold text-ink dark:text-white">{matches.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Unread chapters</p>
            <p className="text-3xl font-semibold text-ink dark:text-white">{unreadMatches.length}</p>
          </div>
        </div>
      </Panel>

      <Panel title="Unread Chapters" className="md:col-span-2">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-full border border-white/60 bg-white/70 p-1 text-sm dark:border-slate-700 dark:bg-slate-900/80">
            {TAB_OPTIONS.map((tab) => (
              <button
                key={tab.id}
                className={`rounded-full px-4 py-1 font-semibold transition ${
                  activeTab === tab.id
                    ? "bg-ink text-white dark:bg-white/90 dark:text-ink"
                    : "text-slate-600 dark:text-slate-300"
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:border-slate-500 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:border-slate-400"
              onClick={refresh}
              disabled={loading || refreshingMatches}
            >
              {refreshingMatches ? (
                <span className="flex items-center gap-2">
                  <span
                    className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                    aria-hidden="true"
                  />
                  Refreshing…
                </span>
              ) : (
                "Refresh"
              )}
            </button>
            <button
              className="rounded-full border border-glow/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-glow hover:border-glow dark:border-glow/70"
              onClick={markVisibleAsRead}
              disabled={!unreadMatches.length}
            >
              Mark all read
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border border-slate-100 bg-white/70 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
            Loading tracker data…
          </div>
        ) : visibleEntries.length ? (
          <>
            {refreshingMatches && (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white/60 px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
                Refreshing matches…
              </div>
            )}
            <ul className="flex flex-col gap-3">
            {visibleEntries.map((entry) => {
              const detailChapters = entry.unreadChapters ?? [];
              const hasDetails = detailChapters.length > 0;
              return (
                <li
                  key={`${entry.title}-${entry.chapterToken ?? "na"}`}
                  className="rounded-2xl border border-slate-100 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      {entry.seriesLink ? (
                        <a
                          href={entry.seriesLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-base font-semibold text-ink underline-offset-2 hover:underline dark:text-white"
                        >
                          {entry.title}
                        </a>
                      ) : (
                        <span className="text-base font-semibold text-ink dark:text-white">{entry.title}</span>
                      )}
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Latest chapter {entry.chapterLabel}
                        {entry.latestSource?.site ? ` • ${entry.latestSource.site}` : ""}
                        {entry.unreadCount ? ` • ${entry.unreadCount} unread` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                          entry.isUnread
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"
                        }`}
                      >
                        {entry.isUnread ? `${entry.unreadCount || 1} Unread` : "Read"}
                      </span>
                      <button
                        className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:border-slate-500 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200 dark:hover:border-slate-400"
                        onClick={() => markEntryRead(entry)}
                        disabled={!entry.isUnread || !entry.chapterToken}
                      >
                        Mark read
                      </button>
                      {hasDetails && (
                        <button
                          type="button"
                          onClick={() => toggleExpanded(entry.title)}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-slate-400 dark:border-slate-600 dark:text-slate-200"
                          aria-label={isExpanded(entry.title) ? "Collapse unread chapters" : "Expand unread chapters"}
                          aria-expanded={isExpanded(entry.title)}
                        >
                          <ArrowToggleIcon expanded={isExpanded(entry.title)} />
                        </button>
                      )}
                    </div>
                  </div>
                  {isExpanded(entry.title) && hasDetails && (
                    <div className="mt-3 rounded-xl border border-slate-100 bg-white/70 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                      <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                        {detailChapters.map((chapter, index) => {
                          const key = chapter.token ?? `${chapter.label ?? "unknown"}-${index}`;
                          const href = chapter.link || entry.seriesLink;
                          const titleContent = `Chapter ${chapter.label ?? "Unknown"}`;
                          const titleNode = href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noreferrer"
                              className="font-semibold text-ink underline-offset-2 hover:underline dark:text-white"
                            >
                              {titleContent}
                            </a>
                          ) : (
                            <span className="font-semibold text-ink dark:text-white">{titleContent}</span>
                          );
                          return (
                            <div
                              key={`${entry.title}-${key}`}
                              className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 last:border-b-0 last:pb-0 dark:border-slate-700"
                            >
                              <div>
                                {titleNode}
                                {chapter.number != null && (
                                  <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    {`#${chapter.number}`}
                                  </p>
                                )}
                                <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                  {formatDetectionAge(chapter.detectedAt, relativeNow)}
                                </p>
                              </div>
                              {!href && (
                                <span className="text-[10px] uppercase tracking-wide text-slate-400">No link</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
            </ul>
          </>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            {emptyCopy}
          </div>
        )}
      </Panel>
    </div>
  );
};

export default DashboardPage;
