"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function WorkGroupForm({ companies, projects, users, currentUserId, defaultCompanyId = "", group }: {
  companies: { id: string; name: string }[];
  projects: { id: string; name: string; companyId: string }[];
  users: { id: string; name: string }[];
  currentUserId: string; defaultCompanyId?: string;
  group?: { id: string; name: string; description: string; companyId: string; projectId: string | null; memberIds: string[] };
}) {
  const router = useRouter();
  const [companyId, setCompanyId] = useState(group?.companyId || defaultCompanyId || companies[0]?.id || "");
  const [projectId, setProjectId] = useState(group?.projectId || "");
  const [name, setName] = useState(group?.name || "");
  const [description, setDescription] = useState(group?.description || "");
  const [members, setMembers] = useState(group?.memberIds.filter((id) => id !== currentUserId) || []);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [success, setSuccess] = useState("");
  useEffect(() => {
    if (!group && defaultCompanyId) { setCompanyId(defaultCompanyId); setProjectId(""); setMembers([]); }
  }, [defaultCompanyId, group]);
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setSuccess("");
    try {
      const response = await fetch(`/api/work-groups${group ? `/${group.id}` : ""}`, {
        method: group ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, memberIds: [...members, currentUserId], ...(!group && { companyId, projectId: projectId || null }) }),
      });
      const data = await response.json().catch(() => ({ error: "Could not confirm the group was saved. Please try again." }));
      if (!response.ok) throw new Error(data.error || "Could not save the group.");
      if (group ? data.updated !== true : typeof data.id !== "string") throw new Error("Could not confirm the group was saved. Please refresh before retrying.");
      if (group) { setSuccess("Group details and members updated."); router.refresh(); }
      else router.push(`/work-groups/${data.id}`);
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  const field = "w-full mt-1 rounded-xl border border-dx-line bg-dx-surface p-3 text-sm text-dx-ink";
  return <form onSubmit={save} className="dx-card p-4 sm:p-5 space-y-4 max-w-2xl">
    <fieldset disabled={busy} className="space-y-4">
      <label className="block text-sm text-dx-ink-muted">Group name<input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className={field} placeholder="e.g. Klang renovation team" /></label>
      <label className="block text-sm text-dx-ink-muted">Description<textarea maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} className={field} rows={2} /></label>
      {!group && <>
        <label className="block text-sm text-dx-ink-muted">Company<select aria-label="Company" value={companyId} disabled={Boolean(defaultCompanyId)} required onChange={(e) => { setCompanyId(e.target.value); setProjectId(""); setMembers([]); }} className={field}>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select></label>
        <label className="block text-sm text-dx-ink-muted">Project<select aria-label="Project" value={projectId} onChange={(e) => setProjectId(e.target.value)} className={field}>
          <option value="">Area or team group without a project</option>
          {projects.filter((p) => p.companyId === companyId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select></label>
      </>}
      <fieldset className="space-y-2"><legend className="text-sm font-medium text-dx-ink mb-2">Group members</legend>
        <p className="text-xs text-dx-ink-muted">You are included as an administrator. Choose the staff who should see this conversation.</p>
        <div className="max-h-64 overflow-y-auto space-y-1">
          {users.filter((u) => u.id !== currentUserId).map((user) => <label key={user.id} className="flex items-center gap-3 min-h-11 text-sm text-dx-ink">
            <input type="checkbox" checked={members.includes(user.id)} onChange={(e) => setMembers((prev) => e.target.checked ? [...prev, user.id] : prev.filter((id) => id !== user.id))} className="w-4 h-4 accent-dx-accent" />{user.name}
          </label>)}
        </div>
      </fieldset>
      <button className="dx-btn-gradient min-h-11" disabled={busy}>{busy ? "Saving…" : group ? "Save group settings" : "Create work group"}</button>
    </fieldset>
    {error && <p role="alert" className="text-sm text-dx-danger">{error}</p>}
    {success && <p role="status" className="text-sm text-dx-success">{success}</p>}
  </form>;
}
