import { useEffect, useMemo, useRef, useState } from "react";

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
  initialTagIds = [],
  availableTags = [],
  websites = [],
  onSubmit,
  onCancel,
  onCreateTag = () => Promise.resolve(null),
  onUpdateTag = () => Promise.resolve(null),
  onDeleteTag = () => Promise.resolve(null),
  onPendingChange = () => {},
}) => {
  const [title, setTitle] = useState(initialValue);
  const [aliasesText, setAliasesText] = useState(initialAliases.join("\n"));
  const [pending, setPending] = useState(false);
  const [siteOverrides, setSiteOverrides] = useState(initialOverrides ?? {});
  const [selectedTagIds, setSelectedTagIds] = useState(initialTagIds ?? []);
  const [tagQuery, setTagQuery] = useState("");
  const [tagActionPending, setTagActionPending] = useState(false);
  const [localTagLabels, setLocalTagLabels] = useState({});
  const [editingTagId, setEditingTagId] = useState(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [tagEditPending, setTagEditPending] = useState(false);
  const [tagDeletePending, setTagDeletePending] = useState(false);
  const tagInputRef = useRef(null);
  const isEditingTag = Boolean(editingTagId);

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

  useEffect(() => {
    setSelectedTagIds(initialTagIds ?? []);
  }, [initialTagIds]);

  useEffect(() => {
    setTagQuery("");
  }, [availableTags]);

  useEffect(() => {
    setLocalTagLabels((prev) => {
      const next = { ...prev };
      availableTags.forEach((tag) => {
        if (next[tag.id] && next[tag.id] === tag.label) {
          delete next[tag.id];
        }
      });
      return next;
    });
  }, [availableTags]);

  useEffect(() => {
    if (!editingTagId) {
      return;
    }
    const stillExists = availableTags.some((tag) => tag.id === editingTagId);
    if (!stillExists) {
      setEditingTagId(null);
      setEditingLabel("");
    }
  }, [availableTags, editingTagId]);

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
        tag_ids: selectedTagIds,
      });
      if (!isEditMode) {
        setTitle("");
        setAliasesText("");
        setSiteOverrides({});
        setSelectedTagIds([]);
        setTagQuery("");
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

  const tagLookup = useMemo(() => {
    const map = new Map();
    availableTags.forEach((tag) => {
      map.set(tag.id, tag.label);
    });
    return map;
  }, [availableTags]);

  const handleTagInputChange = (value) => {
    setTagQuery(value);
    if (editingTagId) {
      setEditingLabel(value);
    }
  };

  const normalizedQuery = tagQuery.trim();

  const availableSuggestions = useMemo(() => {
    if (!normalizedQuery) {
      return availableTags;
    }
    const needle = normalizedQuery.toLowerCase();
    return availableTags.filter((tag) => tag.label.toLowerCase().includes(needle));
  }, [availableTags, normalizedQuery]);

  const handleSelectExistingTag = (tagId) => {
    if (!tagId || selectedTagIds.includes(tagId)) {
      return;
    }
    setSelectedTagIds((prev) => [...prev, tagId]);
    setTagQuery("");
  };

  const handleRemoveTag = (tagId) => {
    setSelectedTagIds((prev) => prev.filter((value) => value !== tagId));
  };

  const handleTagCommit = async () => {
    const label = normalizedQuery;
    if (!label || tagActionPending) {
      return;
    }
    const existing = availableTags.find(
      (tag) => tag.label.toLowerCase() === label.toLowerCase()
    );
    if (existing) {
      handleSelectExistingTag(existing.id);
      return;
    }
    setTagActionPending(true);
    try {
      const created = await onCreateTag({ label });
      if (created?.id) {
        if (created.label) {
          setLocalTagLabels((prev) => ({ ...prev, [created.id]: created.label }));
        }
        handleSelectExistingTag(created.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTagActionPending(false);
      setTagQuery("");
    }
  };

  const handleTagKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (editingTagId) {
        void handleTagRename();
      } else {
        void handleTagCommit();
      }
    }
  };

  const toggleTagEditor = (tag) => {
    if (!tag || tagActionPending || tagEditPending || tagDeletePending) {
      return;
    }
    setEditingTagId((current) => {
      if (current === tag.id) {
        setEditingLabel("");
        setTagQuery("");
        return null;
      }
      setEditingLabel(tag.label);
      setTagQuery(tag.label);
      setTimeout(() => {
        if (tagInputRef.current) {
          tagInputRef.current.focus({ preventScroll: true });
        }
      }, 0);
      return tag.id;
    });
  };

  const cancelTagEdit = () => {
    if (tagEditPending || tagDeletePending) {
      return;
    }
    setEditingTagId(null);
    setEditingLabel("");
    setTagQuery("");
  };

  const handleTagRename = async () => {
    const tagId = editingTagId;
    if (!tagId) {
      return;
    }
    const label = editingLabel.trim();
    if (!label) {
      return;
    }
    setTagEditPending(true);
    try {
      await onUpdateTag(tagId, { label });
      setLocalTagLabels((prev) => ({ ...prev, [tagId]: label }));
      setEditingTagId(null);
      setEditingLabel("");
      setTagQuery("");
    } catch (err) {
      console.error(err);
    } finally {
      setTagEditPending(false);
    }
  };

  const handleTagDelete = async () => {
    const tagId = editingTagId;
    if (!tagId) {
      return;
    }
    setTagDeletePending(true);
    try {
      await onDeleteTag(tagId);
      setSelectedTagIds((prev) => prev.filter((value) => value !== tagId));
      setLocalTagLabels((prev) => {
        const next = { ...prev };
        delete next[tagId];
        return next;
      });
      setEditingTagId(null);
      setEditingLabel("");
      setTagQuery("");
    } catch (err) {
      console.error(err);
    } finally {
      setTagDeletePending(false);
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
            <span className="flex items-center gap-2">
              <span>{isEditMode ? "Update" : "Add"}</span>
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
      <div className="rounded-lg border border-slate-200 bg-white/70 px-4 py-4 dark:border-slate-700 dark:bg-slate-900/50">
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-200">Tags</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Type to search existing tags or press Enter to create a new one.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedTagIds.length === 0 && (
            <span className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
              No tags selected
            </span>
          )}
          {selectedTagIds.map((tagId) => (
            <span
              key={tagId}
              className="inline-flex items-center gap-2 rounded-full border border-glow/40 bg-glow/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-glow"
            >
              {tagLookup.get(tagId) ?? localTagLabels[tagId] ?? tagId}
              <button
                type="button"
                onClick={() => handleRemoveTag(tagId)}
                className="text-[10px] uppercase tracking-wide text-glow/70 hover:text-glow"
                aria-label={`Remove ${tagLookup.get(tagId) ?? localTagLabels[tagId] ?? "tag"}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Search or create
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={tagQuery}
              onChange={(e) => handleTagInputChange(e.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder={isEditingTag ? "Rename tag" : "Adventure"}
              ref={tagInputRef}
              className="flex-1 rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-white"
            />
            <button
              type="button"
              onClick={() => (isEditingTag ? void handleTagRename() : void handleTagCommit())}
              disabled={
                isEditingTag
                  ? !editingLabel.trim() || tagEditPending
                  : !normalizedQuery || tagActionPending
              }
              className="rounded-full border border-white/50 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink shadow-[0_10px_25px_rgba(5,19,26,0.18)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/10 dark:text-white"
            >
              {isEditingTag
                ? tagEditPending
                  ? "Saving…"
                  : "Save"
                : tagActionPending
                ? "Saving…"
                : "Add"}
            </button>
          </div>
          {isEditingTag && (
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-200">
                Editing tag "{tagLookup.get(editingTagId) ?? localTagLabels[editingTagId] ?? ""}"
              </span>
              <button
                type="button"
                onClick={() => void handleTagDelete()}
                disabled={tagDeletePending}
                className="rounded-full border border-rose-200 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-rose-600 hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-500/60 dark:text-rose-300"
              >
                {tagDeletePending ? "Deleting…" : "Delete"}
              </button>
              <button
                type="button"
                onClick={cancelTagEdit}
                disabled={tagEditPending || tagDeletePending}
                className="rounded-full border border-slate-300 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-300"
              >
                Cancel
              </button>
              <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Changes apply everywhere this tag is used.
              </span>
            </div>
          )}
          {availableSuggestions.length > 0 && (
            <div className="rounded-lg border border-slate-100 bg-white/70 p-2 text-xs dark:border-slate-800 dark:bg-slate-900/60">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Suggestions (tap arrow to edit or delete)
              </p>
              <div className="flex flex-wrap gap-2">
                {availableSuggestions.slice(0, 8).map((tag) => {
                  const isEditing = editingTagId === tag.id;
                  const isSelected = selectedTagIds.includes(tag.id);
                  return (
                    <div
                      key={tag.id}
                      className={`inline-flex items-stretch overflow-hidden rounded-full border text-[11px] font-semibold uppercase tracking-wide transition ${
                        isEditing
                          ? "border-glow text-glow"
                          : isSelected
                          ? "border-slate-400 text-slate-500 dark:border-slate-500 dark:text-slate-400"
                          : "border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-200"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectExistingTag(tag.id)}
                        className="px-3 py-1"
                      >
                        {tag.label}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleTagEditor(tag)}
                        className={`border-l px-2 py-1 text-[10px] ${
                          isEditing
                            ? "border-glow/40 text-glow"
                            : "border-slate-200 text-slate-500 hover:border-slate-400 dark:border-slate-600 dark:text-slate-300"
                        }`}
                        aria-label={`Edit ${tag.label}`}
                      >
                        ▾
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </form>
  );
};

export default SeriesForm;
