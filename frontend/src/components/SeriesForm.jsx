import { useEffect, useMemo, useState } from "react";

const extractHost = (value) => {
  if (!value) return "";
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return value;
  }
};

const HelpBadge = ({ text }) => (
  <span
    className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[0.6rem] font-semibold text-slate-500 dark:border-slate-500 dark:text-slate-300"
    title={text}
    aria-label={text}
  >
    ?
  </span>
);

const SeriesForm = ({
  mode = "create",
  initialValue = "",
  initialAliases = [],
  initialOverrides = {},
  websites = [],
  onSubmit,
  onCancel,
  onPendingChange = () => {},
}) => {
  const [title, setTitle] = useState(initialValue);
  const [aliasesText, setAliasesText] = useState(initialAliases.join("\n"));
  const [pending, setPending] = useState(false);
  const [siteOverrides, setSiteOverrides] = useState(initialOverrides ?? {});

  const overrideTargets = useMemo(() => {
    const seen = new Set();
    return websites
      .map((site) => {
        const host = extractHost(site.url);
        if (!host || seen.has(host)) {
          return null;
        }
        seen.add(host);
        return { host, label: site.label ?? host };
      })
      .filter(Boolean);
  }, [websites]);

  useEffect(() => {
    setTitle(initialValue);
  }, [initialValue]);

  useEffect(() => {
    setAliasesText(initialAliases.join("\n"));
  }, [initialAliases]);

  useEffect(() => {
    setSiteOverrides(initialOverrides ?? {});
  }, [initialOverrides]);

  const isEditMode = mode === "edit";

  const parseAliases = (value) =>
    value
      .split(/[\n,]+/)
      .map((alias) => alias.trim())
      .filter(Boolean);

  const buildOverridesPayload = () => {
    const payload = {};
    Object.entries(siteOverrides || {}).forEach(([host, handle]) => {
      const normalizedHost = (host || "").trim().toLowerCase();
      const normalizedHandle = (handle || "").trim();
      if (normalizedHost && normalizedHandle) {
        payload[normalizedHost] = normalizedHandle;
      }
    });
    return payload;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!title.trim()) return;
    setPending(true);
    if (isEditMode) {
      onPendingChange(true);
    }
    try {
      await onSubmit({
        title: title.trim(),
        aliases: parseAliases(aliasesText),
        site_overrides: buildOverridesPayload(),
      });
      if (!isEditMode) {
        setTitle("");
        setAliasesText("");
        setSiteOverrides({});
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPending(false);
      if (isEditMode) {
        onPendingChange(false);
      }
    }
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex-1 text-sm font-medium text-slate-600 dark:text-slate-200">
          <span className="sr-only">Series title</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-base dark:border-slate-700 dark:bg-slate-900/60 dark:text-white dark:placeholder-slate-500"
            type="text"
            placeholder="Frieren"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center justify-center rounded-full border border-white/60 bg-white/70 px-5 py-2 text-base font-semibold text-ink shadow-[0_15px_35px_rgba(5,19,26,0.18)] backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/90 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isEditMode ? (
              <span className="flex items-center gap-2">
                <span>Update</span>
                {pending && (
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                    aria-hidden="true"
                  />
                )}
              </span>
            ) : (
              "Add"
            )}
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
      </div>
      <label className="text-sm font-medium text-slate-600 dark:text-slate-200">
        Alternate titles (comma or newline separated)
        <textarea
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-white dark:placeholder-slate-500"
          rows={3}
          placeholder="Sousou no Frieren, Frieren at the Funeral"
          value={aliasesText}
          onChange={(e) => setAliasesText(e.target.value)}
        />
        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
          Optional. Use this when a site uses a different translation or spelling.
        </span>
      </label>
      {overrideTargets.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white/70 px-4 py-4 dark:border-slate-700 dark:bg-slate-900/50">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-200">
            Site-specific slug overrides
            <HelpBadge text="Only needed for sites that append extra identifiers to the slug. Enter the exact path snippet after the slash." />
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            These values replace {"{handle}"} inside templates for the matching host.
          </p>
          <div className="mt-3 space-y-3">
            {overrideTargets.map((site) => (
              <label key={site.host} className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                {site.label} ({site.host})
                <input
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-white"
                  type="text"
                  placeholder="naruto-b5aedabb"
                  value={siteOverrides[site.host] ?? ""}
                  onChange={(e) =>
                    setSiteOverrides((prev) => ({
                      ...prev,
                      [site.host]: e.target.value,
                    }))
                  }
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </form>
  );
};

export default SeriesForm;
