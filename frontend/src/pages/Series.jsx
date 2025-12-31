import { useEffect, useMemo, useRef, useState } from "react";
import Panel from "../components/Panel";
import SeriesForm from "../components/SeriesForm";
import { useTracker } from "../context/TrackerContext";

const PAGE_SIZE = 25;
const normalizeTitle = (value) => (value ? value.trim().toLowerCase() : "");
const FILTER_OPTIONS = [
  { id: "aliases", label: "Has aliases" },
  { id: "overrides", label: "Has overrides" },
];
const SORT_OPTIONS = [
  { id: "title-asc", label: "Title A to Z" },
  { id: "title-desc", label: "Title Z to A" },
  { id: "aliases-desc", label: "Most aliases" },
  { id: "overrides-desc", label: "Most overrides" },
];

const SeriesPage = () => {
  const {
    data: { series, websites },
    actions: { addSeries, updateSeries, removeSeries },
  } = useTracker();
  const [editingId, setEditingId] = useState(null);
  const [formPending, setFormPending] = useState(false);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOption, setSortOption] = useState("title-asc");
  const [activeFilters, setActiveFilters] = useState({ aliases: false, overrides: false });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const formPanelRef = useRef(null);

  const editingSeries = useMemo(
    () => series.find((item) => item.id === editingId) ?? null,
    [series, editingId]
  );

  const filteredSeries = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return series.filter((item) => {
      if (term) {
        const values = [item.title, ...(item.aliases ?? [])];
        const matchesTerm = values.some((value) => value && value.toLowerCase().includes(term));
        if (!matchesTerm) {
          return false;
        }
      }
      if (activeFilters.aliases && !(item.aliases?.length)) {
        return false;
      }
      if (activeFilters.overrides && !Object.keys(item.site_overrides ?? {}).length) {
        return false;
      }
      return true;
    });
  }, [series, searchTerm, activeFilters]);

  const sortedSeries = useMemo(() => {
    const list = [...filteredSeries];
    const compareTitle = (leftItem, rightItem) => {
      const left = normalizeTitle(leftItem.title);
      const right = normalizeTitle(rightItem.title);
      if (left === right) {
        return (leftItem.title || "").localeCompare(rightItem.title || "", undefined, {
          sensitivity: "base",
          numeric: true,
        });
      }
      return left.localeCompare(right, undefined, { sensitivity: "base", numeric: true });
    };
    const compareAliasCount = (leftItem, rightItem) => {
      const left = leftItem.aliases?.length ?? 0;
      const right = rightItem.aliases?.length ?? 0;
      if (left === right) {
        return compareTitle(leftItem, rightItem);
      }
      return right - left;
    };
    const compareOverrideCount = (leftItem, rightItem) => {
      const left = Object.keys(leftItem.site_overrides ?? {}).length;
      const right = Object.keys(rightItem.site_overrides ?? {}).length;
      if (left === right) {
        return compareTitle(leftItem, rightItem);
      }
      return right - left;
    };
    switch (sortOption) {
      case "title-desc":
        return list.sort((a, b) => compareTitle(b, a));
      case "aliases-desc":
        return list.sort(compareAliasCount);
      case "overrides-desc":
        return list.sort(compareOverrideCount);
      case "title-asc":
      default:
        return list.sort(compareTitle);
    }
  }, [filteredSeries, sortOption]);

  const totalSeries = sortedSeries.length;
  const totalPages = Math.max(1, Math.ceil(totalSeries / PAGE_SIZE));

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, activeFilters, sortOption]);

  useEffect(() => {
    const hasActiveFilters = Object.values(activeFilters).some(Boolean);
    if (hasActiveFilters) {
      setFiltersOpen(true);
    }
  }, [activeFilters]);

  useEffect(() => {
    if (editingId && formPanelRef.current) {
      formPanelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      const firstInput = formPanelRef.current.querySelector("input");
      if (firstInput) {
        firstInput.focus({ preventScroll: true });
      }
    }
  }, [editingId]);

  const currentPage = Math.min(page, totalPages);
  const sliceStart = (currentPage - 1) * PAGE_SIZE;
  const visibleSeries = sortedSeries.slice(sliceStart, sliceStart + PAGE_SIZE);
  const showPagination = totalSeries > PAGE_SIZE;
  const rangeStart = totalSeries ? sliceStart + 1 : 0;
  const rangeEnd = totalSeries ? Math.min(sliceStart + visibleSeries.length, totalSeries) : 0;
  const currentSortLabel = SORT_OPTIONS.find((option) => option.id === sortOption)?.label ?? "Title A to Z";
  const rangeCopy = totalSeries
    ? `${currentSortLabel} - Showing ${rangeStart}-${rangeEnd} of ${totalSeries}`
    : currentSortLabel;
  const activeFilterCount = Object.values(activeFilters).filter(Boolean).length;

  const goToPrevious = () => setPage((prev) => Math.max(1, prev - 1));
  const goToNext = () => setPage((prev) => Math.min(totalPages, prev + 1));
  const toggleFilter = (filterId) => {
    setActiveFilters((prev) => ({
      ...prev,
      [filterId]: !prev[filterId],
    }));
  };
  const clearFilters = () => setActiveFilters({ aliases: false, overrides: false });

  const handleCreate = async ({ title, aliases, site_overrides }) => {
    await addSeries({ title, aliases, site_overrides });
  };

  const handleUpdate = async ({ title, aliases, site_overrides }) => {
    if (!editingId) return;
    await updateSeries(editingId, { title, aliases, site_overrides });
    setEditingId(null);
  };

  const handleDelete = async (id) => {
    try {
      await removeSeries(id);
      if (editingId === id) {
        setEditingId(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <Panel
        ref={formPanelRef}
        title={editingSeries ? "Edit Tracked Manga" : "Add Tracked Manga"}
        copy={
          editingSeries
            ? `Updating ${editingSeries.title}`
            : "Add titles you want to monitor across every site."
        }
      >
        <SeriesForm
          mode={editingSeries ? "edit" : "create"}
          initialValue={editingSeries?.title ?? ""}
          initialAliases={editingSeries?.aliases ?? []}
          initialOverrides={editingSeries?.site_overrides ?? {}}
          websites={websites}
          onSubmit={editingSeries ? handleUpdate : handleCreate}
          onCancel={() => setEditingId(null)}
          onPendingChange={setFormPending}
        />
      </Panel>

      <Panel title="Tracked Manga" copy="Series currently being monitored">
        {series.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No titles yet. Add one above to get started.</p>
        ) : (
          <>
            <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-slate-600 dark:text-slate-200 lg:flex-row lg:items-center lg:gap-3">
                <span>Search tracked manga</span>
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Title or alias"
                  className="w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-white lg:max-w-md"
                />
              </label>
              <div className="flex flex-wrap items-center gap-3 lg:items-center lg:justify-end">
                <button
                  type="button"
                  onClick={() => setFiltersOpen((prev) => !prev)}
                  className={`flex h-11 items-center rounded-xl border px-4 text-xs font-semibold uppercase tracking-wide transition ${
                    filtersOpen
                      ? "border-glow bg-glow/10 text-glow"
                      : "border-slate-300 text-slate-600 hover:border-slate-500 dark:border-slate-600 dark:text-slate-200"
                  }`}
                >
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="ml-2 rounded-full bg-white/80 px-2 py-0.5 text-[10px] text-ink dark:bg-white/20 dark:text-white">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-600 dark:text-slate-200 lg:flex-row lg:items-center lg:gap-3">
                  <span>Sort by</span>
                  <select
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value)}
                    className="h-11 rounded-xl border border-white/30 bg-white/40 px-4 py-2 text-sm font-semibold text-slate-700 shadow-[0_15px_35px_rgba(5,19,26,0.18)] backdrop-blur-md transition focus:outline-none focus:ring-2 focus:ring-glow/60 dark:border-white/20 dark:bg-white/10 dark:text-white"
                  >
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id} className="bg-white/90 text-ink dark:bg-slate-900 dark:text-white">
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            {filtersOpen && (
              <div className="mb-4 rounded-2xl border border-slate-100 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
                <div className="mb-3 flex items-center justify-between gap-3 text-sm font-semibold text-slate-600 dark:text-slate-200">
                  Filters
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-xs font-semibold uppercase tracking-wide text-glow hover:underline disabled:opacity-40"
                    disabled={activeFilterCount === 0}
                  >
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {FILTER_OPTIONS.map((option) => {
                    const isActive = activeFilters[option.id];
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => toggleFilter(option.id)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                          isActive
                            ? "border-glow bg-glow/10 text-glow"
                            : "border border-slate-300 text-slate-600 hover:border-slate-500 dark:border-slate-600 dark:text-slate-200"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  {filteredSeries.length} matching title{filteredSeries.length === 1 ? "" : "s"}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{rangeCopy}</p>
              </div>
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
            </div>
            {totalSeries === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
                No matches for this search or filter combo.
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {visibleSeries.map((item) => {
                  const aliasCount = item.aliases?.length ?? 0;
                  const overrideCount = Object.keys(item.site_overrides ?? {}).length;
                  return (
                    <li
                      key={item.id}
                      className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70"
                    >
                      <div>
                        <p className="font-semibold text-ink dark:text-white">{item.title}</p>
                        {aliasCount > 0 && (
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Also known as: {item.aliases.join(", ")}
                          </p>
                        )}
                        {overrideCount > 0 && (
                          <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                            {overrideCount} override{overrideCount === 1 ? "" : "s"}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:border-slate-500 dark:border-slate-600 dark:text-slate-200 dark:hover:border-slate-400"
                          onClick={() => setEditingId(item.id)}
                          disabled={formPending}
                        >
                          Edit
                        </button>
                        <button
                          className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-600 hover:border-rose-400 dark:border-rose-500/60 dark:text-rose-300"
                          onClick={() => handleDelete(item.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </Panel>
    </div>
  );
};

export default SeriesPage;
