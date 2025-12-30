import Panel from "../components/Panel";
import { useEffect, useMemo, useState } from "react";
import { useTracker } from "../context/TrackerContext";
import { formatDetectionAge } from "../utils/time";
import useRelativeNow from "../hooks/useRelativeNow";

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
    className="text-slate-600 dark:text-slate-300"
  >
    <path d={expanded ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} />
  </svg>
);

const PAGE_SIZE = 25;
const normalizeTitle = (value) => (value ? value.trim().toLowerCase() : "");

const TrackedPage = () => {
  const {
    data: { websites, series, matchSummaries },
    status: { loading, refreshingMatches },
    actions: { refreshMatches },
  } = useTracker();
  const [expandedTitles, setExpandedTitles] = useState(() => new Set());
  const [page, setPage] = useState(1);
  const relativeNow = useRelativeNow();

  const sortedMatches = useMemo(() => {
    return [...matchSummaries].sort((a, b) => {
      const left = normalizeTitle(a.title);
      const right = normalizeTitle(b.title);
      if (left === right) {
        return (a.title || "").localeCompare(b.title || "", undefined, {
          sensitivity: "base",
          numeric: true,
        });
      }
      return left.localeCompare(right, undefined, { sensitivity: "base", numeric: true });
    });
  }, [matchSummaries]);

  const totalMatches = sortedMatches.length;
  const totalPages = Math.max(1, Math.ceil(totalMatches / PAGE_SIZE));

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const currentPage = Math.min(page, totalPages);
  const sliceStart = (currentPage - 1) * PAGE_SIZE;
  const visibleMatches = sortedMatches.slice(sliceStart, sliceStart + PAGE_SIZE);
  const rangeStart = totalMatches ? sliceStart + 1 : 0;
  const rangeEnd = totalMatches ? Math.min(sliceStart + visibleMatches.length, totalMatches) : 0;
  const showPagination = totalMatches > PAGE_SIZE;
  const rangeCopy = totalMatches
    ? `Sorted A to Z • Showing ${rangeStart}-${rangeEnd} of ${totalMatches}`
    : "Sorted A to Z";

  const goToPrevious = () => setPage((prev) => Math.max(1, prev - 1));
  const goToNext = () => setPage((prev) => Math.min(totalPages, prev + 1));

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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {matchSummaries.length} match{matchSummaries.length === 1 ? "" : "es"} across {websites.length} site
              {websites.length === 1 ? "" : "s"}.
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">{rangeCopy}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {showPagination && (
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
                <button
                  type="button"
                  onClick={goToPrevious}
                  disabled={currentPage === 1}
                  className="px-1 text-[11px] disabled:opacity-40"
                >
                  Prev
                </button>
                <span>
                  Page {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={goToNext}
                  disabled={currentPage === totalPages}
                  className="px-1 text-[11px] disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
            <button
              className="text-xs font-semibold uppercase tracking-wide text-glow disabled:opacity-60"
              onClick={handleRefresh}
              disabled={loading || refreshingMatches}
            >
              {refreshingMatches ? (
                <span className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent"
                    aria-hidden="true"
                  />
                  Refreshing…
                </span>
              ) : (
                "Refresh"
              )}
            </button>
          </div>
        </div>
        {loading ? (
          <div className="rounded-xl border border-slate-100 bg-white/70 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
            Loading tracker data…
          </div>
        ) : matchSummaries.length ? (
          <ul className="flex flex-col gap-2">
            {visibleMatches.map((entry) => {
              const siteLabel = entry.latestSource?.site;
              const chapterLabel = entry.chapterLabel ?? "Unknown";
              const detailChapters = entry.unreadChapters ?? [];
              const hasDetails = detailChapters.length > 0;
              return (
                <li
                  key={`${entry.title}-${entry.chapterToken ?? "na"}`}
                  className="rounded-xl border border-slate-100 bg-white/70 px-4 py-2 text-sm dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      {entry.seriesLink ? (
                        <a
                          href={entry.seriesLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-semibold text-ink underline-offset-2 hover:underline dark:text-white"
                        >
                          {entry.title}
                        </a>
                      ) : (
                        <span className="text-sm font-semibold text-ink dark:text-white">{entry.title}</span>
                      )}
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Chapter {chapterLabel}
                        {siteLabel ? ` • ${siteLabel}` : ""}
                        {entry.unreadCount ? ` • ${entry.unreadCount} unread` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
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
                      {entry.seriesLink && (
                        <a
                          href={entry.seriesLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold uppercase tracking-wide text-glow hover:underline"
                        >
                          Open site
                        </a>
                      )}
                    </div>
                  </div>
                  {isExpanded(entry.title) && hasDetails && (
                    <div className="mt-2 rounded-xl border border-slate-200 bg-white/70 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
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
                              className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2 last:border-b-0 last:pb-0 dark:border-slate-700"
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
        ) : (
          <div className="rounded-xl border-2 border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            {matchesEmptyCopy}
          </div>
        )}
      </Panel>
    </div>
  );
};

export default TrackedPage;
