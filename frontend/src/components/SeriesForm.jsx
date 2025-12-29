import { useEffect, useState } from "react";

const SeriesForm = ({
  mode = "create",
  initialValue = "",
  initialAliases = [],
  onSubmit,
  onCancel,
}) => {
  const [title, setTitle] = useState(initialValue);
  const [aliasesText, setAliasesText] = useState(initialAliases.join("\n"));
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setTitle(initialValue);
  }, [initialValue]);

  useEffect(() => {
    setAliasesText(initialAliases.join("\n"));
  }, [initialAliases]);

  const isEditMode = mode === "edit";

  const parseAliases = (value) =>
    value
      .split(/[\n,]+/)
      .map((alias) => alias.trim())
      .filter(Boolean);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!title.trim()) return;
    setPending(true);
    try {
      await onSubmit({ title: title.trim(), aliases: parseAliases(aliasesText) });
      if (!isEditMode) {
        setTitle("");
        setAliasesText("");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex-1 text-sm font-medium text-slate-600">
          <span className="sr-only">Series title</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-base"
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
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-glow to-ember px-5 py-2 text-base font-semibold text-ink shadow-md transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isEditMode ? "Update" : "Add"}
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
      </div>
      <label className="text-sm font-medium text-slate-600">
        Alternate titles (comma or newline separated)
        <textarea
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm"
          rows={3}
          placeholder="Sousou no Frieren, Frieren at the Funeral"
          value={aliasesText}
          onChange={(e) => setAliasesText(e.target.value)}
        />
        <span className="mt-1 block text-xs text-slate-500">
          Optional. Use this when a site uses a different translation or spelling.
        </span>
      </label>
    </form>
  );
};

export default SeriesForm;
