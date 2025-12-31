import { useEffect, useMemo, useState } from "react";

const HelpBadge = ({ text }) => (
  <span
    className="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[0.6rem] font-semibold text-slate-500 dark:border-slate-500 dark:text-slate-300"
    title={text}
    aria-label={text}
  >
    ?
  </span>
);

const defaultForm = {
  label: "",
  url: "",
  paginationMode: "none",
  pageParam: "",
  pageStart: 1,
  pageCount: 1,
  pageTemplate: "",
  simplePageParam: "",
  seriesTemplate: "",
  chapterTemplate: "",
};

const buildFormState = (site) => {
  if (!site) {
    return { ...defaultForm };
  }
  const base = {
    label: site.label ?? "",
    url: site.url ?? "",
    paginationMode: "none",
    pageParam: "",
    pageStart: 1,
    pageCount: 1,
    pageTemplate: "",
    simplePageParam: "",
    seriesTemplate: site.series_url_template ?? "",
    chapterTemplate: site.chapter_url_template ?? "",
  };
  const pagination = site.pagination;
  if (!pagination) {
    return base;
  }
  if (pagination.strategy === "query") {
    return {
      ...base,
      paginationMode: "query",
      pageParam: pagination.parameter ?? "",
      pageStart: pagination.start ?? 1,
      pageCount: pagination.pages ?? 1,
    };
  }
  if (pagination.strategy === "path") {
    return {
      ...base,
      paginationMode: "path",
      pageTemplate: pagination.template ?? "",
      pageStart: pagination.start ?? 1,
      pageCount: pagination.pages ?? 1,
    };
  }
  return base;
};

const clampPages = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.max(1, Math.min(10, Math.round(parsed)));
};

const clampStart = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.round(parsed);
};

const WebsiteForm = ({ mode = "create", initialValues = null, onSubmit, onCancel }) => {
  const [form, setForm] = useState(() => buildFormState(initialValues));
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setForm(buildFormState(initialValues));
  }, [initialValues]);

  const isEditMode = mode === "edit";

  const paginationPayload = useMemo(() => {
    if (form.paginationMode === "query" && form.pageParam.trim()) {
      return {
        strategy: "query",
        parameter: form.pageParam.trim(),
        start: clampStart(form.pageStart),
        pages: clampPages(form.pageCount),
      };
    }
    if (form.paginationMode === "path" && form.pageTemplate.includes("{page}")) {
      return {
        strategy: "path",
        template: form.pageTemplate.trim(),
        start: clampStart(form.pageStart),
        pages: clampPages(form.pageCount),
      };
    }
    if (form.paginationMode === "none" && form.simplePageParam.trim()) {
      return {
        strategy: "query",
        parameter: form.simplePageParam.trim(),
        start: 1,
        pages: clampPages(form.pageCount),
      };
    }
    return null;
  }, [form]);

  const buildPayload = () => {
    const payload = {
      label: form.label.trim(),
      url: form.url.trim(),
    };
    if (paginationPayload) {
      payload.pagination = paginationPayload;
    } else if (isEditMode) {
      payload.pagination = null;
    }
    const seriesTemplate = form.seriesTemplate.trim();
    const chapterTemplate = form.chapterTemplate.trim();
    if (seriesTemplate) {
      payload.series_url_template = seriesTemplate;
    } else if (isEditMode) {
      payload.series_url_template = null;
    }
    if (chapterTemplate) {
      payload.chapter_url_template = chapterTemplate;
    } else if (isEditMode) {
      payload.chapter_url_template = null;
    }
    return payload;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.label.trim() || !form.url.trim()) return;
    setPending(true);
    try {
      await onSubmit(buildPayload());
      if (!isEditMode) {
        setForm({ ...defaultForm });
      }
    } catch (err) {
      // Context provider surfaces the error; the catch prevents unhandled rejections
      console.error(err);
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <label className="text-sm font-medium text-slate-600 dark:text-slate-200">
        Friendly name
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-base dark:border-slate-700 dark:bg-slate-900/60 dark:text-white dark:placeholder-slate-500"
          type="text"
          placeholder="MangaDex"
          value={form.label}
          onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
          required
        />
      </label>
      <label className="text-sm font-medium text-slate-600 dark:text-slate-200">
        URL
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-base dark:border-slate-700 dark:bg-slate-900/60 dark:text-white dark:placeholder-slate-500"
          type="url"
          placeholder="https://mangadex.org"
          value={form.url}
          onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
          required
        />
      </label>
      <label className="text-sm font-medium text-slate-600 dark:text-slate-200">
        <span className="flex items-center gap-2">
          Series page URL template
          <HelpBadge text="Use {title} or {slug}, or {handle} for any site-specific override. Example: https://site.com/manga/{handle}" />
        </span>
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-base dark:border-slate-700 dark:bg-slate-900/60 dark:text-white dark:placeholder-slate-500"
          type="text"
          placeholder="https://site.com/manga/{slug}"
          value={form.seriesTemplate}
          onChange={(e) => setForm((prev) => ({ ...prev, seriesTemplate: e.target.value }))}
        />
      </label>
      <label className="text-sm font-medium text-slate-600 dark:text-slate-200">
        <span className="flex items-center gap-2">
          Chapter page URL template
          <HelpBadge text="Use {chapter_number} or {chapter_label}, plus {slug} or {handle}. Example: https://site.com/manga/{handle}/chapter-{chapter_number}" />
        </span>
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-base dark:border-slate-700 dark:bg-slate-900/60 dark:text-white dark:placeholder-slate-500"
          type="text"
          placeholder="https://site.com/manga/{slug}/chapter-{chapter_number}"
          value={form.chapterTemplate}
          onChange={(e) => setForm((prev) => ({ ...prev, chapterTemplate: e.target.value }))}
        />
      </label>

      {form.paginationMode === "none" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-200">
            Pagination parameter (optional)
            <input
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-white dark:placeholder-slate-500"
              type="text"
              placeholder="page or list"
              value={form.simplePageParam}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, simplePageParam: e.target.value }))
              }
            />
          </label>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-200">
            Pages to scan
            <input
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-white"
              type="number"
              min={1}
              max={10}
              value={form.pageCount}
              onChange={(e) => setForm((prev) => ({ ...prev, pageCount: e.target.value }))}
            />
          </label>
        </div>
      )}

      <div className="rounded-lg border border-dashed border-slate-200 bg-white/60 px-3 py-3 dark:border-slate-700 dark:bg-slate-900/40">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Pagination strategy
          <select
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-white"
            value={form.paginationMode}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, paginationMode: e.target.value }))
            }
          >
            <option value="none">Single page (default)</option>
            <option value="query">Query parameter (?page=2)</option>
            <option value="path">Path template (/page/{"{page}"})</option>
          </select>
        </label>

        {form.paginationMode === "query" && (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-200">
              Parameter name
              <input
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-white"
                type="text"
                placeholder="page"
                value={form.pageParam}
                onChange={(e) => setForm((prev) => ({ ...prev, pageParam: e.target.value }))}
              />
            </label>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-200">
              Start
              <input
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-white"
                type="number"
                min={1}
                value={form.pageStart}
                onChange={(e) => setForm((prev) => ({ ...prev, pageStart: e.target.value }))}
              />
            </label>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-200">
              Pages to scan
              <input
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-white"
                type="number"
                min={1}
                max={10}
                value={form.pageCount}
                onChange={(e) => setForm((prev) => ({ ...prev, pageCount: e.target.value }))}
              />
            </label>
          </div>
        )}

        {form.paginationMode === "path" && (
          <div className="mt-3 space-y-3">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-200">
              Template (use {"{page}"})
              <input
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-white"
                type="text"
                placeholder="https://site.com/page/{page}"
                value={form.pageTemplate}
                onChange={(e) => setForm((prev) => ({ ...prev, pageTemplate: e.target.value }))}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-200">
                Start
                <input
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-white"
                  type="number"
                  min={1}
                  value={form.pageStart}
                  onChange={(e) => setForm((prev) => ({ ...prev, pageStart: e.target.value }))}
                />
              </label>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-200">
                Pages to scan
                <input
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-white"
                  type="number"
                  min={1}
                  max={10}
                  value={form.pageCount}
                  onChange={(e) => setForm((prev) => ({ ...prev, pageCount: e.target.value }))}
                />
              </label>
            </div>
          </div>
        )}

        <p className="mt-2 text-[0.7rem] text-slate-500 dark:text-slate-400">
          Leave this as single page if the site lists everything on one view. Otherwise supply a query param or a template that includes {"{page}"}.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-full border border-white/60 bg-white/70 px-5 py-2 text-base font-semibold text-ink shadow-[0_15px_35px_rgba(5,19,26,0.18)] backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/90 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="flex items-center gap-2">
            <span>{isEditMode ? "Update Website" : "Add Website"}</span>
            {pending && (
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                aria-hidden="true"
              />
            )}
          </span>
        </button>
        {isEditMode && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-400 dark:border-slate-600 dark:text-slate-200 dark:hover:border-slate-400"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
};

export default WebsiteForm;
