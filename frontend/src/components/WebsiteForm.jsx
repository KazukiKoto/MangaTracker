import { useEffect, useMemo, useState } from "react";

const defaultForm = {
  label: "",
  url: "",
  paginationMode: "none",
  pageParam: "",
  pageStart: 1,
  pageCount: 1,
  pageTemplate: "",
  simplePageParam: "",
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
      <label className="text-sm font-medium text-slate-600">
        Friendly name
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-base"
          type="text"
          placeholder="MangaDex"
          value={form.label}
          onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
          required
        />
      </label>
      <label className="text-sm font-medium text-slate-600">
        URL
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-base"
          type="url"
          placeholder="https://mangadex.org"
          value={form.url}
          onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
          required
        />
      </label>

      {form.paginationMode === "none" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-slate-600">
            Pagination parameter (optional)
            <input
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
              type="text"
              placeholder="page or list"
              value={form.simplePageParam}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, simplePageParam: e.target.value }))
              }
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Pages to scan
            <input
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
              type="number"
              min={1}
              max={10}
              value={form.pageCount}
              onChange={(e) => setForm((prev) => ({ ...prev, pageCount: e.target.value }))}
            />
          </label>
        </div>
      )}

      <div className="rounded-lg border border-dashed border-slate-200 bg-white/60 px-3 py-3">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Pagination strategy
          <select
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
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
            <label className="text-xs font-medium text-slate-600">
              Parameter name
              <input
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
                type="text"
                placeholder="page"
                value={form.pageParam}
                onChange={(e) => setForm((prev) => ({ ...prev, pageParam: e.target.value }))}
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Start
              <input
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
                type="number"
                min={1}
                value={form.pageStart}
                onChange={(e) => setForm((prev) => ({ ...prev, pageStart: e.target.value }))}
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Pages to scan
              <input
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
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
            <label className="text-xs font-medium text-slate-600">
              Template (use {"{page}"})
              <input
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
                type="text"
                placeholder="https://site.com/page/{page}"
                value={form.pageTemplate}
                onChange={(e) => setForm((prev) => ({ ...prev, pageTemplate: e.target.value }))}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-slate-600">
                Start
                <input
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
                  type="number"
                  min={1}
                  value={form.pageStart}
                  onChange={(e) => setForm((prev) => ({ ...prev, pageStart: e.target.value }))}
                />
              </label>
              <label className="text-xs font-medium text-slate-600">
                Pages to scan
                <input
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
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

        <p className="mt-2 text-[0.7rem] text-slate-500">
          Leave this as single page if the site lists everything on one view. Otherwise supply a query param or a template that includes {"{page}"}.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-glow to-ember px-5 py-2 text-base font-semibold text-ink shadow-md transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isEditMode ? "Update Website" : "Add Website"}
        </button>
        {isEditMode && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-400"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
};

export default WebsiteForm;
