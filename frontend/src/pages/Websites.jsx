import { useMemo, useState } from "react";
import Panel from "../components/Panel";
import WebsiteForm from "../components/WebsiteForm";
import { useTracker } from "../context/TrackerContext";

const describePagination = (pagination) => {
  if (!pagination) return "Single page snapshot";
  if (pagination.strategy === "query") {
    return `Query param "${pagination.parameter ?? "page"}" • start ${pagination.start ?? 1} • ${
      pagination.pages ?? 1
    } pages`;
  }
  if (pagination.strategy === "path") {
    return `Path template • start ${pagination.start ?? 1} • ${pagination.pages ?? 1} pages`;
  }
  return "Custom pagination";
};

const WebsitesPage = () => {
  const {
    data: { websites },
    actions: { addSite, updateSite, removeSite },
  } = useTracker();
  const [editingId, setEditingId] = useState(null);

  const editingSite = useMemo(
    () => websites.find((site) => site.id === editingId) ?? null,
    [websites, editingId]
  );

  const handleCreate = async (payload) => {
    await addSite(payload);
  };

  const handleUpdate = async (payload) => {
    if (!editingId) return;
    await updateSite(editingId, payload);
    setEditingId(null);
  };

  const handleDelete = async (siteId) => {
    try {
      await removeSite(siteId);
      if (editingId === siteId) {
        setEditingId(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <Panel
        title={editingSite ? "Edit Website" : "Add Website"}
        copy={
          editingSite
            ? `Updating ${editingSite.label}`
            : "Add the sources you want to poll."
        }
      >
        <WebsiteForm
          mode={editingSite ? "edit" : "create"}
          initialValues={editingSite}
          onSubmit={editingSite ? handleUpdate : handleCreate}
          onCancel={() => setEditingId(null)}
        />
      </Panel>

      <Panel title="Tracked Websites" copy="Existing sources currently being scanned">
        {websites.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No websites yet. Add one above to get started.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {websites.map((site) => (
              <li
                key={site.id}
                className="rounded-2xl border border-slate-100 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-base font-semibold text-ink dark:text-white">{site.label}</p>
                    <a
                      href={site.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-glow hover:underline"
                    >
                      {site.url}
                    </a>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{describePagination(site.pagination)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:border-slate-500 dark:border-slate-600 dark:text-slate-200 dark:hover:border-slate-400"
                      onClick={() => setEditingId(site.id)}
                    >
                      Edit
                    </button>
                    <button
                      className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-600 hover:border-rose-400 dark:border-rose-500/60 dark:text-rose-300"
                      onClick={() => handleDelete(site.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
};

export default WebsitesPage;
