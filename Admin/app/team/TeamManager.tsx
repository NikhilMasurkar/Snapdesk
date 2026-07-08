"use client";

import { useState, useTransition } from "react";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/roles";
import { removeAdmin, setAdminRole } from "./actions";

type Member = { userId: string; role: Role; email: string };

export default function TeamManager({ members }: { members: Member[] }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("snap_employee");

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) => {
    setMsg(null);
    startTransition(async () => {
      const res = await fn();
      setMsg(res.ok ? { ok: true, text: okText } : { ok: false, text: res.error ?? "Failed" });
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {msg && (
        <p
          className={`rounded-lg px-4 py-2 text-sm ${
            msg.ok ? "bg-success-bg text-success" : "bg-danger-bg text-danger"
          }`}
        >
          {msg.text}
        </p>
      )}

      {/* Add / assign */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">
          Add or update a member
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold text-muted">
            Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="person@example.com"
              className="mt-1 block w-64 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground"
            />
          </label>
          <label className="text-xs font-semibold text-muted">
            Role
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="mt-1 block rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={pending || !email.trim()}
            onClick={() => run(() => setAdminRole(email, role), "Role assigned")}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
          >
            Assign role
          </button>
        </div>
        <p className="mt-2 text-[11px] text-muted">
          The person must have signed into the admin site at least once (Google
          or email) before they can be assigned a role.
        </p>
      </section>

      {/* Members list */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">
          Team members ({members.length})
        </h2>
        <ul className="divide-y divide-border/60">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{m.email}</p>
                <p className="text-xs text-muted">{ROLE_LABELS[m.role]}</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  defaultValue={m.role}
                  onChange={(e) =>
                    run(() => setAdminRole(m.email, e.target.value as Role), "Role updated")
                  }
                  disabled={pending}
                  className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
                <button
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm(`Remove ${m.email} from the admin team?`))
                      run(() => removeAdmin(m.userId), "Member removed");
                  }}
                  className="rounded-lg border border-danger/40 px-3 py-1 text-xs font-bold text-danger hover:bg-danger-bg disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
