const SeriesCard = ({ match }) => {
  const orderedSources = [...match.sources].sort((a, b) => {
    const left = a.latest_chapter_number ?? -1;
    const right = b.latest_chapter_number ?? -1;
    if (left !== right) return right - left;
    return a.site.localeCompare(b.site);
  });
  const bestSource =
    orderedSources.find((source) => typeof source.latest_chapter_number === "number") ||
    orderedSources.find((source) => Boolean(source.latest_chapter));
  const mostRecentChapter = bestSource
    ? bestSource.latest_chapter ?? String(bestSource.latest_chapter_number)
    : null;

  return (
    <li className="rounded-xl border border-slate-100 bg-slate-50/70 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-ink dark:text-white">{match.title}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Most recent chapter: {mostRecentChapter ?? "Unknown"}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {orderedSources.length} source{orderedSources.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {orderedSources.map((source) => {
          const chapterDisplay =
            source.latest_chapter ??
            (source.latest_chapter_number != null
              ? String(source.latest_chapter_number)
              : "Unknown");
          return (
            <li
              key={`${match.title}-${source.site}-${source.link ?? "nolink"}-${chapterDisplay}`}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/70 bg-white/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/70"
            >
              <div>
                {source.link ? (
                  <a
                    href={source.link}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-ink hover:text-glow dark:text-white"
                  >
                    {source.site}
                  </a>
                ) : (
                  <span className="font-semibold text-ink dark:text-white">{source.site}</span>
                )}
                <p className="text-xs text-slate-500 dark:text-slate-400">Latest chapter: {chapterDisplay}</p>
              </div>
              {source.link && (
                <a
                  href={source.link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold uppercase tracking-wide text-glow"
                >
                  Open
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </li>
  );
};

export default SeriesCard;
