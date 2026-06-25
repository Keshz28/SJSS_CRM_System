"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  Shield,
  User as UserIcon,
  KeyRound,
  Trash2,
  CheckCircle,
  AlertCircle,
  X,
} from "lucide-react";

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "USER";
  isActive: boolean;
  createdAt: string;
}

const fieldCls =
  "w-full bg-dx-surface border border-dx-line rounded-xl px-3 py-2.5 text-sm text-dx-ink placeholder-dx-ink-faint focus:outline-none focus:border-dx-accent transition-colors";
const labelCls = "block text-sm font-medium text-dx-ink-muted mb-1.5";

function extractError(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "error" in data) {
    const e = (data as { error: unknown }).error;
    if (typeof e === "string") return e;
    if (e && typeof e === "object" && "formErrors" in e) {
      const fe = e as { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
      const first =
        fe.formErrors?.[0] ?? Object.values(fe.fieldErrors ?? {})[0]?.[0];
      if (first) return first;
    }
  }
  return fallback;
}

export function UsersManager({
  initialUsers,
  currentUserId,
}: {
  initialUsers: UserRecord[];
  currentUserId: string;
}) {
  const router = useRouter();

  // ── Add-user form state ──
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ADMIN" | "USER">("USER");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState("");

  // ── Reset-password modal ──
  const [resetUser, setResetUser] = useState<UserRecord | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setAddError("");
    setAddSuccess("");

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role }),
    });

    setAdding(false);
    if (!res.ok) {
      setAddError(extractError(await res.json().catch(() => ({})), "Could not create the user."));
      return;
    }
    setAddSuccess(`${name} added successfully.`);
    setName("");
    setEmail("");
    setPassword("");
    setRole("USER");
    router.refresh();
  }

  async function toggleRole(u: UserRecord) {
    const next = u.role === "ADMIN" ? "USER" : "ADMIN";
    const res = await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: next }),
    });
    if (!res.ok) alert(extractError(await res.json().catch(() => ({})), "Could not change role."));
    router.refresh();
  }

  async function toggleActive(u: UserRecord) {
    const res = await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !u.isActive }),
    });
    if (!res.ok) alert(extractError(await res.json().catch(() => ({})), "Could not update the account."));
    router.refresh();
  }

  async function handleDelete(u: UserRecord) {
    if (!confirm(`Delete ${u.name}? This cannot be undone.`)) return;
    const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(extractError(data, "Could not delete the user."));
      return;
    }
    if (data.deactivated) alert(data.message);
    router.refresh();
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Add user */}
      <form onSubmit={handleAdd} className="dx-card p-5 space-y-4">
        <div className="flex items-center gap-3 border-b border-dx-line pb-4">
          <div className="w-10 h-10 rounded-xl bg-dx-accent/10 flex items-center justify-center">
            <UserPlus className="w-5 h-5 text-dx-accent" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-dx-ink">Add a new account</h3>
            <p className="text-xs text-dx-ink-faint">Create a login for a staff member or another admin</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Full Name</label>
            <input className={fieldCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ali bin Ahmad" required />
          </div>
          <div>
            <label className={labelCls}>Email (used to log in)</label>
            <input className={fieldCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. ali@sjss.com" required />
          </div>
          <div>
            <label className={labelCls}>Temporary Password</label>
            <input className={fieldCls} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" required />
          </div>
          <div>
            <label className={labelCls}>Role</label>
            <select className={fieldCls} value={role} onChange={(e) => setRole(e.target.value as "ADMIN" | "USER")}>
              <option value="USER">Staff (standard access)</option>
              <option value="ADMIN">Administrator (full access)</option>
            </select>
          </div>
        </div>

        {addError && (
          <p className="flex items-center gap-2 text-xs text-dx-danger bg-dx-danger/10 border border-dx-danger/30 rounded-xl px-3 py-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {addError}
          </p>
        )}
        {addSuccess && (
          <p className="flex items-center gap-2 text-xs text-[#14CA74] bg-[#14CA74]/10 border border-[#14CA74]/30 rounded-xl px-3 py-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0" /> {addSuccess}
          </p>
        )}

        <button type="submit" disabled={adding} className="dx-btn-gradient">
          <UserPlus className="w-4 h-4" /> {adding ? "Adding…" : "Add User"}
        </button>
      </form>

      {/* User list */}
      <div className="dx-card p-5">
        <h3 className="text-sm font-semibold text-dx-ink mb-4">All accounts ({initialUsers.length})</h3>
        <div className="space-y-2">
          {initialUsers.map((u) => {
            const isSelf = u.id === currentUserId;
            return (
              <div
                key={u.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-dx-line bg-dx-surface px-4 py-3"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-dx-accent to-dx-accent-2 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-semibold">
                    {u.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-dx-ink truncate">
                    {u.name} {isSelf && <span className="text-dx-ink-faint font-normal">(you)</span>}
                  </p>
                  <p className="text-xs text-dx-ink-faint truncate">{u.email}</p>
                </div>

                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg ${
                    u.role === "ADMIN" ? "bg-dx-accent/15 text-dx-accent" : "bg-dx-line/50 text-dx-ink-muted"
                  }`}
                >
                  {u.role === "ADMIN" ? <Shield className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
                  {u.role === "ADMIN" ? "Admin" : "Staff"}
                </span>

                {!u.isActive && (
                  <span className="text-xs font-medium px-2 py-1 rounded-lg bg-dx-danger/15 text-dx-danger">
                    Inactive
                  </span>
                )}

                <div className="flex items-center gap-1.5 ml-auto">
                  <button
                    onClick={() => toggleRole(u)}
                    disabled={isSelf}
                    title={u.role === "ADMIN" ? "Make staff" : "Make admin"}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-dx-line text-dx-ink-muted hover:text-dx-ink hover:border-dx-accent/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {u.role === "ADMIN" ? "Make staff" : "Make admin"}
                  </button>
                  <button
                    onClick={() => toggleActive(u)}
                    disabled={isSelf}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-dx-line text-dx-ink-muted hover:text-dx-ink hover:border-dx-accent/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {u.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => setResetUser(u)}
                    title="Reset password"
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-dx-line text-dx-ink-muted hover:text-dx-ink hover:border-dx-accent/40 transition-colors"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(u)}
                    disabled={isSelf}
                    title="Delete user"
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-dx-line text-dx-ink-muted hover:text-dx-danger hover:border-dx-danger/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {resetUser && (
        <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} />
      )}
    </div>
  );
}

function ResetPasswordModal({ user, onClose }: { user: UserRecord; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(extractError(await res.json().catch(() => ({})), "Could not reset the password."));
      return;
    }
    setDone(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="dx-card w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-dx-ink">Reset password</h3>
          <button onClick={onClose} className="text-dx-ink-faint hover:text-dx-ink">
            <X className="w-4 h-4" />
          </button>
        </div>
        {done ? (
          <>
            <p className="flex items-center gap-2 text-xs text-[#14CA74] bg-[#14CA74]/10 border border-[#14CA74]/30 rounded-xl px-3 py-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" /> Password updated for {user.name}.
            </p>
            <button onClick={onClose} className="dx-btn-gradient w-full justify-center">Done</button>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-xs text-dx-ink-muted">
              Set a new password for <span className="text-dx-ink font-medium">{user.name}</span>. Share it with them securely.
            </p>
            <input
              className={fieldCls}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password (min 6 chars)"
              required
            />
            {error && (
              <p className="flex items-center gap-2 text-xs text-dx-danger bg-dx-danger/10 border border-dx-danger/30 rounded-xl px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
              </p>
            )}
            <button type="submit" disabled={saving} className="dx-btn-gradient w-full justify-center">
              <KeyRound className="w-4 h-4" /> {saving ? "Saving…" : "Reset Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
