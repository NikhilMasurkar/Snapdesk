"use client";

import { useState, useTransition } from "react";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/roles";
import { removeAdmin, setAdminRoles } from "./actions";

type Member = { userId: string; roles: Role[]; email: string };

const sameSet = (a: Role[], b: Role[]) =>
  a.length === b.length && a.every((r) => b.includes(r));

function RoleBoxes({
  value,
  onChange,
  disabledFor,
}: {
  value: Role[];
  onChange: (r: Role) => void;
  disabledFor: (r: Role) => boolean;
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {ROLES.map((r) => (
        <label
          key={r}
          className={`flex items-center gap-1.5 text-xs ${
            disabledFor(r) ? "text-muted opacity-60" : "text-foreground"
          }`}
        >
          <input
            type="checkbox"
            checked={value.includes(r)}
            onChange={() => onChange(r)}
            disabled={disabledFor(r)}
            className="size-3.5 accent-[var(--primary,#6366f1)]"
          />
          {ROLE_LABELS[r]}
        </label>
      ))}
    </div>
  );
}

export default function TeamManager({
  members,
  currentUserId,
  callerIsSuper,
}: {
  members: Member[];
  currentUserId: string;
  callerIsSuper: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Add form
  const [email, setEmail] = useState("");
  const [newRoles, setNewRoles] = useState<Role[]>(["snap_employee"]);

  // Per-row draft role sets; saved only on explicit "Save".
  const [drafts, setDrafts] = useState<Record<string, Role[]>>(
    Object.fromEntries(members.map((m) => [m.userId, m.roles]))
  );

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) => {
    setMsg(null);
    startTransition(async () => {
      const res = await fn();
      setMsg(res.ok ? { ok: true, text: okText } : { ok: false, text: res.error ?? "Failed" });
    });
  };

  const toggle = (list: Role[], r: Role): Role[] =>
    list.includes(r) ? list.filter((x) => x !== r) : [...list, r];

  /** Checkbox rules: superadmin grant + any removal need a super admin. */
  const boxDisabled = (m: Member, r: Role): boolean => {
    if (pending || m.userId === currentUserId) return true;
    if (callerIsSuper) return false;
    if (r === "superadmin") return true; // only SA grants SA
    return m.roles.includes(r); // unchecking an existing role = removal = SA only
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
        <div className="flex flex-col gap-3">
          <label className="text-xs font-semibold text-muted">
            Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="person@example.com"
              className="mt-1 block w-64 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground"
            />
          </label>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-muted">Roles</p>
            <RoleBoxes
              value={newRoles}
              onChange={(r) => setNewRoles((p) => toggle(p, r))}
              disabledFor={(r) => pending || (r === "superadmin" && !callerIsSuper)}
            />
          </div>
          <div>
            <button
              disabled={pending || !email.trim() || newRoles.length === 0}
              onClick={() => run(() => setAdminRoles(email, newRoles), "Roles assigned")}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
            >
              Assign roles
            </button>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted">
          The person must have signed into the admin site at least once (Google
          or email) first. Admins can add roles; only a super admin can remove
          roles or grant Super Admin.
        </p>
      </section>

      {/* Members list */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">
          Team members ({members.length})
        </h2>
        <ul className="divide-y divide-border/60">
          {members.map((m) => {
            const isSelf = m.userId === currentUserId;
            const draft = drafts[m.userId] ?? m.roles;
            const dirty = !sameSet(draft, m.roles);
            return (
              <li key={m.userId} className="flex flex-col gap-2 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {m.email}
                    {isSelf && <span className="ml-1 text-xs text-muted">(you)</span>}
                  </p>
                  <div className="flex shrink-0 items-center gap-2">
                    {dirty && (
                      <button
                        disabled={pending}
                        onClick={() =>
                          run(() => setAdminRoles(m.email, draft), "Roles updated")
                        }
                        className="rounded-lg bg-primary px-3 py-1 text-xs font-bold text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
                      >
                        Save
                      </button>
                    )}
                    {callerIsSuper && (
                      <button
                        disabled={pending || isSelf}
                        onClick={() => {
                          if (window.confirm(`Remove ${m.email} from the admin team?`))
                            run(() => removeAdmin(m.userId), "Member removed");
                        }}
                        className="rounded-lg border border-danger/40 px-3 py-1 text-xs font-bold text-danger hover:bg-danger-bg disabled:opacity-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                <RoleBoxes
                  value={draft}
                  onChange={(r) =>
                    setDrafts((p) => ({ ...p, [m.userId]: toggle(p[m.userId] ?? m.roles, r) }))
                  }
                  disabledFor={(r) => boxDisabled(m, r)}
                />
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
