"use client";

import { uploadForm } from "@/lib/upload-client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Save, WifiOff } from "lucide-react";
import {
  MediaComposer,
  type StagedMedia,
} from "@/components/media/MediaComposer";
import { deleteDraft, readDraft, writeDraft } from "@/lib/capture-drafts";
import { onDraftsCleared } from "@/lib/draft-revision";
import { siteVisitDetailHref } from "@/lib/site-visit-navigation";
interface ProjectOption {
  id: string;
  name: string;
  companyId: string;
  customerId: string | null;
  location: string | null;
}
interface Props {
  customers: { id: string; name: string; companyId: string | null }[];
  companies: { id: string; name: string; prefix: string }[];
  projects: ProjectOption[];
  ownerId: string;
  defaultCompanyId?: string;
  defaultProjectId?: string;
  returnTo?: string;
  existingVisit?: {
    id: string;
    title: string;
    companyId: string;
    projectId: string | null;
    customerId: string | null;
    location: string | null;
    notes: string | null;
    contactName: string | null;
    contactPhone: string | null;
  };
}
interface Draft {
  requestId: string;
  savedVisitId?: string;
  companyId: string;
  projectId: string;
  mode: "new" | "existing";
  customerId: string;
  contactName: string;
  contactPhone: string;
  title: string;
  location: string;
  notes: string;
  media: StagedMedia[];
}
const field =
  "mt-1.5 w-full bg-dx-surface border border-dx-line rounded-xl px-3 py-3 text-sm text-dx-ink focus:outline-none focus:border-dx-accent";
const label = "block text-sm font-medium text-dx-ink-muted";
export function SiteVisitCapture({
  customers,
  companies,
  projects,
  ownerId,
  defaultCompanyId,
  defaultProjectId,
  existingVisit,
  returnTo,
}: Props) {
  const router = useRouter();
  const initialProject = projects.find((p) => p.id === defaultProjectId);
  const [draft, setDraft] = useState<Draft>(() => ({
    requestId: "",
    savedVisitId: existingVisit?.id,
    companyId:
      existingVisit?.companyId ||
      initialProject?.companyId ||
      defaultCompanyId ||
      companies[0]?.id ||
      "",
    projectId: existingVisit?.projectId || initialProject?.id || "",
    mode:
      existingVisit?.customerId || initialProject?.customerId
        ? "existing"
        : "new",
    customerId: existingVisit?.customerId || initialProject?.customerId || "",
    contactName: existingVisit?.contactName || "",
    contactPhone: existingVisit?.contactPhone || "",
    title: existingVisit?.title || (initialProject ? "Site update" : ""),
    location: existingVisit?.location || initialProject?.location || "",
    notes: existingVisit?.notes || "",
    media: [],
  }));
  const key = `capture:${ownerId}:${existingVisit?.id || defaultProjectId || (defaultCompanyId ? `general:${defaultCompanyId}` : "general")}`;
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recording, setRecording] = useState(false);
  const [online, setOnline] = useState(true);
  const [status, setStatus] = useState("Loading your draft…");
  const [error, setError] = useState("");
  const [storageWarning, setStorageWarning] = useState("");
  const complete = useRef(false);
  useEffect(() => onDraftsCleared(ownerId, () => { complete.current = true; window.location.reload(); }), [ownerId]);
  const project = projects.find((p) => p.id === draft.projectId);
  const back = existingVisit ? siteVisitDetailHref(existingVisit.id, returnTo) : returnTo || (project ? `/projects/${project.id}` : "/site-visits");
  useEffect(() => {
    let active = true;
    readDraft<Draft>(key)
      .then((saved) => {
        if (active) {
          setDraft(
            (current) =>
              saved || { ...current, requestId: crypto.randomUUID() },
          );
          setStatus(
            saved
              ? "Draft restored from this device"
              : "Drafts save on this device",
          );
        }
      })
      .catch(() => {
        if (active) {
          setDraft((current) => ({
            ...current,
            requestId: crypto.randomUUID(),
          }));
          setStorageWarning(
            "Device storage is unavailable. Keep this page open until your update uploads.",
          );
        }
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [key]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    if (!loaded || complete.current) return;
    setStatus("Saving draft…");
    const timer = setTimeout(() => {
      if (!complete.current)
        writeDraft(key, draft)
          .then(() => {
            if (!complete.current) setStatus("Draft saved on this device");
          })
          .catch(() =>
            setStorageWarning(
              "Device storage is full or unavailable. Keep this page open and upload before leaving.",
            ),
          );
    }, 200);
    return () => clearTimeout(timer);
  }, [draft, key, loaded]);
  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!draft.companyId || !draft.title.trim()) {
      setError("Choose a company and add an update title.");
      return;
    }
    if (
      draft.mode === "existing" &&
      !draft.customerId &&
      !project?.customerId
    ) {
      setError("Choose a customer or switch to a new prospect.");
      return;
    }
    setSaving(true);
    let current = draft;
    async function persist(value: Draft) {
      try {
        await writeDraft(key, value);
        setStorageWarning("");
      } catch {
        if (!navigator.onLine)
          throw new Error(
            "Device storage is unavailable and you are offline. Keep this page open until you can upload.",
          );
        setStorageWarning(
          "Device storage is unavailable. Keep this page open while the upload completes.",
        );
      }
    }
    try {
      await persist(current); // Finish persisting before any network work.
      if (!navigator.onLine)
        throw new Error(
          "You are offline. Your draft is saved here. Tap Save update when your connection returns.",
        );
      if (!current.savedVisitId) {
        setStatus("Saving update…");
        const response = await fetch("/api/site-visits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientRequestId: current.requestId,
            projectId: current.projectId || null,
            companyId: current.companyId,
            title: current.title.trim(),
            customerId:
              project?.customerId ||
              (current.mode === "existing" ? current.customerId : null),
            contactName: current.mode === "new" ? current.contactName : null,
            contactPhone: current.mode === "new" ? current.contactPhone : null,
            location: current.location,
            notes: current.notes,
          }),
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(
            typeof data.error === "string"
              ? data.error
              : "Could not save the update. Check the details and retry.",
          );
        current = { ...current, savedVisitId: data.id };
        setDraft(current);
        await persist(current);
      }
      for (const item of current.media) {
        if (item.uploaded) continue;
        setStatus(
          `Uploading ${current.media.filter((m) => m.uploaded).length + 1} of ${current.media.length}…`,
        );
        const form = new FormData();
        form.set("siteVisitId", current.savedVisitId!);
        form.set("clientUploadId", item.id);
        form.set("caption", item.caption);
        form.set(
          "file",
          new File([item.blob], item.name, { type: item.mimetype }),
        );
        const response = await uploadForm("/api/uploads", form);
        const data = await response.json();
        if (!response.ok)
          throw new Error(
            data.error ||
              "A file could not upload. Retry to continue the same update.",
          );
        current = {
          ...current,
          media: current.media.map((m) =>
            m.id === item.id ? { ...m, uploaded: true } : m,
          ),
        };
        setDraft(current);
        await persist(current);
      }
      complete.current = true;
      await deleteDraft(key).catch(() => {});
      router.push(siteVisitDetailHref(current.savedVisitId!, returnTo));
      router.refresh();
    } catch (err) {
      setError(
        (err as Error).message ||
          "Connection interrupted. Your draft is saved; retry to continue.",
      );
      setStatus("Needs retry · draft retained on this device");
      setSaving(false);
    }
  }
  async function discard() {
    if (
      !confirm(
        "Discard this device's draft? Any already uploaded items will stay in the saved update.",
      )
    )
      return;
    complete.current = true;
    await deleteDraft(key);
    router.push(back);
    router.refresh();
  }
  if (!loaded)
    return (
      <p className="text-dx-ink-muted" role="status">
        Loading your draft…
      </p>
    );
  return (
    <form onSubmit={submit} className="space-y-5 max-w-3xl pb-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link href={back} className="text-sm text-dx-accent">
          ← Back{existingVisit ? " to site update" : ""}
        </Link>
        <p role="status" className="text-xs text-dx-ink-muted">
          {!online && <WifiOff className="w-4 h-4 inline mr-1" />}
          {status}
        </p>
      </div>
      {storageWarning && (
        <p role="alert" className="text-sm text-amber-400">
          {storageWarning}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-400"
        >
          {error}
        </p>
      )}
      {draft.savedVisitId && !existingVisit && (
        <p className="text-sm text-dx-ink-muted">
          Update saved. Retry will continue its remaining uploads without
          creating another visit.{" "}
          <Link
            className="text-dx-accent underline"
            href={siteVisitDetailHref(draft.savedVisitId, returnTo)}
          >
            View saved update
          </Link>
        </p>
      )}
      <fieldset
        disabled={saving || Boolean(draft.savedVisitId)}
        className="dx-card p-4 sm:p-5 space-y-4 disabled:opacity-70"
      >
        <label className={label}>
          Project
          <select
            aria-label="Project"
            className={field}
            value={draft.projectId}
            onChange={(e) => {
              const p = projects.find((p) => p.id === e.target.value);
              setDraft((d) => ({
                ...d,
                projectId: e.target.value,
                companyId: p?.companyId || d.companyId,
                customerId: p?.customerId || "",
                mode: p?.customerId ? "existing" : "new",
                contactName: "",
                contactPhone: "",
                location: p?.location || "",
              }));
            }}
          >
            <option value="">Standalone site visit</option>
            {projects.filter((p) => p.companyId === draft.companyId).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-dx-ink-faint">
          Company:{" "}
          {companies.find((c) => c.id === draft.companyId)?.name ||
            "Choose a company"}
        </p>
        {!project && (
          <Link
            href="/projects/new"
            className="text-xs text-dx-accent inline-block"
          >
            + Create a named project
          </Link>
        )}
        <label className={label}>
          Update title
          <input
            required
            maxLength={160}
            className={field}
            placeholder="e.g. Kitchen measurements — first visit"
            value={draft.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </label>
      </fieldset>
      <MediaComposer
        media={draft.media}
        onChange={(media) => set("media", media)}
        onRecordingChange={setRecording}
        disabled={saving}
      />
      <details className="dx-card p-4 sm:p-5">
        <summary className="cursor-pointer min-h-11 text-sm font-medium text-dx-ink-muted">
          Customer, site address & notes
        </summary>
        <fieldset
          disabled={saving || Boolean(draft.savedVisitId)}
          className="space-y-4 pt-3"
        >
          <label className={label}>
            Company
            <select
              aria-label="Company"
              disabled={Boolean(project || defaultCompanyId)}
              className={field}
              value={draft.companyId}
              onChange={(e) => setDraft((d) => ({ ...d, companyId: e.target.value, customerId: "", projectId: "" }))}
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {!project?.customerId && (
            <div>
              <span className={label}>Customer</span>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  aria-pressed={draft.mode === "new"}
                  onClick={() => set("mode", "new")}
                  className={`dx-btn-ghost flex-1 min-h-11 ${draft.mode === "new" ? "border-dx-accent text-dx-accent" : ""}`}
                >
                  New prospect
                </button>
                <button
                  type="button"
                  aria-pressed={draft.mode === "existing"}
                  onClick={() => set("mode", "existing")}
                  className={`dx-btn-ghost flex-1 min-h-11 ${draft.mode === "existing" ? "border-dx-accent text-dx-accent" : ""}`}
                >
                  Existing customer
                </button>
              </div>
              {draft.mode === "existing" ? (
                <label className={label}>
                  <span className="sr-only">Select customer</span>
                  <select
                    aria-label="Select customer"
                    className={field}
                    value={draft.customerId}
                    onChange={(e) => set("customerId", e.target.value)}
                  >
                    <option value="">Select a customer…</option>
                    {customers.filter((c) => c.companyId === draft.companyId).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3 mt-3">
                  <label className={label}>
                    Contact name
                    <input
                      className={field}
                      value={draft.contactName}
                      onChange={(e) => set("contactName", e.target.value)}
                    />
                  </label>
                  <label className={label}>
                    Phone
                    <input
                      type="tel"
                      className={field}
                      value={draft.contactPhone}
                      onChange={(e) => set("contactPhone", e.target.value)}
                    />
                  </label>
                </div>
              )}
            </div>
          )}
          <label className={label}>
            Site address
            <input
              className={field}
              maxLength={500}
              value={draft.location}
              onChange={(e) => set("location", e.target.value)}
            />
          </label>
          <label className={label}>
            Update notes
            <textarea
              className={field}
              maxLength={5000}
              value={draft.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              placeholder="Measurements, progress, materials or work to follow up…"
            />
          </label>
        </fieldset>
      </details>
      <div className="sticky bottom-20 lg:bottom-0 z-10 rounded-xl border border-dx-line bg-dx-bg/95 backdrop-blur p-3 flex items-center gap-3 flex-wrap">
        <button
          type="submit"
          disabled={saving || recording}
          className="dx-btn-gradient min-h-11"
        >
          <Save className="w-4 h-4" />
          {saving ? "Uploading…" : "Save update"}
        </button>
        <button
          type="button"
          disabled={saving || recording}
          className="dx-btn-ghost min-h-11"
          onClick={discard}
        >
          Discard draft
        </button>
        {recording && (
          <span className="text-xs text-dx-ink-muted">
            Stop recording before saving.
          </span>
        )}
      </div>
    </form>
  );
}
