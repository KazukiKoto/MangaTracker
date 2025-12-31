import { useMemo, useState } from "react";
import Panel from "../components/Panel";
import WebsiteForm from "../components/WebsiteForm";
import { useTracker } from "../context/TrackerContext";
import { formatDetectionAge } from "../utils/time";

const REAUTH_WAIT_SECONDS = 45;

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
    status: { loading },
    actions: { addSite, updateSite, removeSite, reauthenticateSite },
  } = useTracker();
  const [editingId, setEditingId] = useState(null);
  const [reauthingId, setReauthingId] = useState(null);
  const [manualSubmittingId, setManualSubmittingId] = useState(null);
  const [reauthFeedback, setReauthFeedback] = useState({});
  const [manualForms, setManualForms] = useState({});

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

  const handleReauth = async (site) => {
    if (!site?.id) return;
    if (typeof window !== "undefined" && site.url) {
      window.open(site.url, "_blank", "noopener,noreferrer");
    }
    setReauthingId(site.id);
    setReauthFeedback((prev) => ({
      ...prev,
      [site.id]: {
        type: "info",
        text: "Complete the Cloudflare check in the new tab…",
      },
    }));
    try {
      const response = await reauthenticateSite(site.id, { wait_seconds: REAUTH_WAIT_SECONDS });
      setReauthFeedback((prev) => ({
        ...prev,
        [site.id]: {
          type: "success",
          text: `Captured ${response.cookies_found} authentication cookie${response.cookies_found === 1 ? "" : "s"}.`,
        },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to re-authenticate.";
      setReauthFeedback((prev) => ({
        ...prev,
        [site.id]: {
          type: "error",
          text: message,
        },
      }));
    } finally {
      setReauthingId((prev) => (prev === site.id ? null : prev));
    }
  };

  const toggleManualForm = (siteId) => {
    setManualForms((prev) => {
      const next = { ...prev };
      const current = next[siteId] ?? { open: false, cf_clearance: "", __cf_bm: "" };
      next[siteId] = { ...current, open: !current.open };
      return next;
    });
  };

  const updateManualField = (siteId, field, value) => {
    setManualForms((prev) => ({
      ...prev,
      [siteId]: {
        open: prev[siteId]?.open ?? false,
        cf_clearance: field === "cf_clearance" ? value : prev[siteId]?.cf_clearance ?? "",
        __cf_bm: field === "__cf_bm" ? value : prev[siteId]?.__cf_bm ?? "",
      },
    }));
  };

  const handleManualSubmit = async (site) => {
    const form = manualForms[site.id] || {};
    const payload = {};
    if (form.cf_clearance?.trim()) {
      payload.cf_clearance = form.cf_clearance.trim();
    }
    if (form.__cf_bm?.trim()) {
      payload.__cf_bm = form.__cf_bm.trim();
    }
    if (!Object.keys(payload).length) {
      setReauthFeedback((prev) => ({
        ...prev,
        [site.id]: { type: "error", text: "Enter at least one cookie value." },
      }));
      return;
    }
    setManualSubmittingId(site.id);
    try {
      const response = await reauthenticateSite(site.id, { manual_cookies: payload });
      setReauthFeedback((prev) => ({
        ...prev,
        [site.id]: {
          type: "success",
          text: `Stored ${response.cookies_found} cookie${response.cookies_found === 1 ? "" : "s"}.`,
        },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save cookies.";
      setReauthFeedback((prev) => ({
        ...prev,
        [site.id]: {
          type: "error",
          text: message,
        },
      }));
    } finally {
      setManualSubmittingId((prev) => (prev === site.id ? null : prev));
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
        {loading ? (
          <div className="rounded-2xl border border-slate-100 bg-white/80 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
            Loading tracked websites…
          </div>
        ) : websites.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No websites yet. Add one above to get started.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {websites.map((site) => {
              const feedback = reauthFeedback[site.id];
              const manualState = manualForms[site.id] || { open: false, cf_clearance: "", __cf_bm: "" };
              const feedbackTone = feedback?.type === "error"
                ? "text-rose-600"
                : feedback?.type === "success"
                ? "text-emerald-600"
                : "text-slate-500";
              return (
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
                      {site.last_reauth_at && (
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          Last re-authenticated {formatDetectionAge(site.last_reauth_at)}
                        </p>
                      )}
                      {feedback?.text && (
                        <p
                          className={`mt-1 text-xs font-semibold ${feedbackTone}`}
                          role="status"
                          aria-live="polite"
                        >
                          {feedback.text}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="rounded-full border border-amber-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700 hover:border-amber-400 disabled:opacity-60 dark:border-amber-400/80 dark:text-amber-200"
                        onClick={() => handleReauth(site)}
                        disabled={reauthingId === site.id}
                      >
                        {reauthingId === site.id ? (
                          <span className="flex items-center gap-2">
                            <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" aria-hidden="true" />
                            Re-authing…
                          </span>
                        ) : (
                          "Re-authenticate"
                        )}
                      </button>
                      <button
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:border-slate-400 dark:border-slate-600 dark:text-slate-300"
                        onClick={() => toggleManualForm(site.id)}
                      >
                        {manualState.open ? "Hide manual entry" : "Manual entry"}
                      </button>
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
                    {manualState.open && (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs dark:border-slate-700 dark:bg-slate-900/40">
                        <p className="mb-2 text-slate-500 dark:text-slate-400">
                          Paste the `cf_clearance` (and optional `__cf_bm`) values from your browser's dev tools cookies for
                          this site and we will store them for future scans.
                        </p>
                        <div className="flex flex-col gap-2">
                          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            cf_clearance
                            <input
                              type="text"
                              value={manualState.cf_clearance}
                              onChange={(event) => updateManualField(site.id, "cf_clearance", event.target.value)}
                              className="rounded border border-slate-300 bg-white px-2 py-1 text-sm text-ink focus:border-slate-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                              placeholder="Paste value"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            __cf_bm (optional)
                            <input
                              type="text"
                              value={manualState.__cf_bm}
                              onChange={(event) => updateManualField(site.id, "__cf_bm", event.target.value)}
                              className="rounded border border-slate-300 bg-white px-2 py-1 text-sm text-ink focus:border-slate-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                              placeholder="Paste value"
                            />
                          </label>
                        </div>
                        <button
                          className="mt-2 rounded-full border border-emerald-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700 hover:border-emerald-400 disabled:opacity-60 dark:border-emerald-400/80 dark:text-emerald-200"
                          onClick={() => handleManualSubmit(site)}
                          disabled={manualSubmittingId === site.id}
                        >
                          {manualSubmittingId === site.id ? (
                            <span className="flex items-center gap-2">
                              <span
                                className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent"
                                aria-hidden="true"
                              />
                              Saving…
                            </span>
                          ) : (
                            "Save cookies"
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
};

export default WebsitesPage;
