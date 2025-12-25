import { useMemo, useState } from "react";
import Panel from "../components/Panel";
import SeriesForm from "../components/SeriesForm";
import { useTracker } from "../context/TrackerContext";

const SeriesPage = () => {
  const {
    data: { series },
    actions: { addSeries, updateSeries, removeSeries },
  } = useTracker();
  const [editingId, setEditingId] = useState(null);

  const editingSeries = useMemo(
    () => series.find((item) => item.id === editingId) ?? null,
    [series, editingId]
  );

  const handleCreate = async ({ title }) => {
    await addSeries({ title });
  };

  const handleUpdate = async ({ title }) => {
    if (!editingId) return;
    await updateSeries(editingId, { title });
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
        title={editingSeries ? "Edit Series" : "Add Series"}
        copy={editingSeries ? `Renaming ${editingSeries.title}` : "Whitelist only the series you care about."}
      >
        <SeriesForm
          mode={editingSeries ? "edit" : "create"}
          initialValue={editingSeries?.title ?? ""}
          onSubmit={editingSeries ? handleUpdate : handleCreate}
          onCancel={() => setEditingId(null)}
        />
      </Panel>

      <Panel title="Reading Whitelist" copy="Series currently being monitored">
        {series.length === 0 ? (
          <p className="text-sm text-slate-500">No series yet. Add one above to get started.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {series.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white/80 px-4 py-3"
              >
                <span className="font-semibold text-ink">{item.title}</span>
                <div className="flex gap-2">
                  <button
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:border-slate-500"
                    onClick={() => setEditingId(item.id)}
                  >
                    Edit
                  </button>
                  <button
                    className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-600 hover:border-rose-400"
                    onClick={() => handleDelete(item.id)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
};

export default SeriesPage;
