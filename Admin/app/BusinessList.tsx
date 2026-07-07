"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { Business } from "@/lib/types";
import {
  approveBusiness,
  deleteRejectedBusiness,
  reactivateBusiness,
  rejectBusiness,
  suspendBusiness,
  type ActionResult,
  type Plan,
} from "./actions";

export default function BusinessList({
  businesses,
  menuBaseUrl,
}: {
  businesses: Business[];
  menuBaseUrl: string;
}) {
  const [, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = (id: string, action: () => Promise<ActionResult>) => {
    setBusyId(id);
    setError(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) setError(result.error);
      } finally {
        setBusyId(null);
      }
    });
  };

  const pending = businesses.filter((b) => b.status === "pending");
  const approved = businesses.filter((b) => b.status === "approved");
  const suspended = businesses.filter((b) => b.status === "suspended");
  const rejected = businesses.filter((b) => b.status === "rejected");

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <p className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-300">{error}</p>
      )}

      {/* Inquiry queue */}
      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-amber-400">
          Pending applications {pending.length > 0 && `(${pending.length})`}
        </h2>
        {pending.length === 0 ? (
          <Empty>No pending applications — all caught up.</Empty>
        ) : (
          <div className="flex flex-col gap-3">
            {pending.map((b) => (
              <PendingCard key={b.id} b={b} busy={busyId === b.id} run={run} />
            ))}
          </div>
        )}
      </section>

      {/* Approved */}
      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-400">
          Approved ({approved.length})
        </h2>
        {approved.length === 0 ? (
          <Empty>No approved businesses yet.</Empty>
        ) : (
          <div className="flex flex-col gap-3">
            {approved.map((b) => (
              <div key={b.id} className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:flex-row sm:items-center sm:justify-between">
                <BusinessInfo b={b} menuBaseUrl={menuBaseUrl} />
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-[10px] font-bold uppercase text-zinc-400">
                    {b.plan} · {b.table_count} tables
                  </span>
                  <button
                    disabled={busyId === b.id}
                    onClick={() => {
                      const reason = window.prompt(`Suspend "${b.name}" — reason (owner locked out, page goes dark):`);
                      if (reason?.trim()) run(b.id, () => suspendBusiness(b.id, reason));
                    }}
                    className="rounded-lg border border-red-900 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-950 disabled:opacity-50"
                  >
                    Suspend
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Suspended */}
      {suspended.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-red-400">
            Suspended ({suspended.length})
          </h2>
          <div className="flex flex-col gap-3">
            {suspended.map((b) => (
              <div key={b.id} className="flex flex-col gap-3 rounded-xl border border-red-900/40 bg-zinc-900 p-4 sm:flex-row sm:items-center sm:justify-between">
                <BusinessInfo b={b} />
                <div className="flex shrink-0 items-center gap-2">
                  {b.admin_notes && (
                    <span className="max-w-[200px] truncate text-xs text-zinc-500" title={b.admin_notes}>
                      “{b.admin_notes}”
                    </span>
                  )}
                  <button
                    disabled={busyId === b.id}
                    onClick={() => run(b.id, () => reactivateBusiness(b.id))}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    Reactivate
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Rejected */}
      {rejected.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-600">
            Rejected ({rejected.length})
          </h2>
          <div className="flex flex-col gap-3">
            {rejected.map((b) => (
              <div key={b.id} className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 opacity-75 sm:flex-row sm:items-center sm:justify-between">
                <BusinessInfo b={b} />
                <div className="flex shrink-0 items-center gap-2">
                  {b.admin_notes && (
                    <span className="max-w-[200px] truncate text-xs text-zinc-500" title={b.admin_notes}>
                      “{b.admin_notes}”
                    </span>
                  )}
                  <button
                    disabled={busyId === b.id}
                    onClick={() => {
                      if (window.confirm(`Delete "${b.name}" permanently? The owner can then apply again.`)) {
                        run(b.id, () => deleteRejectedBusiness(b.id));
                      }
                    }}
                    className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-400 hover:bg-zinc-800 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** Full application card with inline approve form (plan + table count). */
function PendingCard({
  b,
  busy,
  run,
}: {
  b: Business;
  busy: boolean;
  run: (id: string, action: () => Promise<ActionResult>) => void;
}) {
  const [approving, setApproving] = useState(false);
  const [plan, setPlan] = useState<Plan>("free");
  const [tables, setTables] = useState("10");

  return (
    <div className="rounded-xl border border-amber-500/30 bg-zinc-900 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/business/${b.id}`} className="font-bold hover:underline">
              {b.name}
            </Link>
            <Tag>{b.type}</Tag>
            <span className="text-xs text-zinc-500">
              applied {new Date(b.created_at).toLocaleDateString()}
            </span>
          </div>
          {/* Full application, spec 4.3 */}
          <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-zinc-400 sm:grid-cols-2">
            <Field label="Owner">{b.owner_name ?? "—"} · {b.owner_phone ?? "—"}</Field>
            <Field label="Email">{b.owner_email ?? "—"}</Field>
            <Field label="WhatsApp">{b.whatsapp_number}</Field>
            <Field label="Address">{[b.address, b.city, b.pincode].filter(Boolean).join(", ") || "—"}</Field>
            <Field label="Hours">{b.opening_hours ?? "—"}</Field>
            <Field label="GST">{b.gst_number ?? "—"}</Field>
            {b.tagline && <Field label="Tagline">{b.tagline}</Field>}
          </dl>
        </div>

        <div className="flex shrink-0 gap-2">
          {!approving ? (
            <>
              <button
                disabled={busy}
                onClick={() => setApproving(true)}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                Approve…
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  const reason = window.prompt(`Reject "${b.name}" — reason (saved to admin notes):`);
                  if (reason?.trim()) run(b.id, () => rejectBusiness(b.id, reason));
                }}
                className="rounded-lg border border-red-900 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-950 disabled:opacity-50"
              >
                Reject
              </button>
            </>
          ) : null}
        </div>
      </div>

      {approving && (
        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <label className="text-xs font-semibold text-zinc-400">
            Plan
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value as Plan)}
              className="mt-1 block rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-white"
            >
              <option value="free">Free — 30 items</option>
              <option value="basic">Basic — photos, 100 items</option>
              <option value="premium">Premium — all features, 500 items</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-zinc-400">
            Tables
            <input
              type="number"
              min={0}
              max={200}
              value={tables}
              onChange={(e) => setTables(e.target.value)}
              className="mt-1 block w-24 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-white"
            />
          </label>
          <button
            disabled={busy}
            onClick={() => {
              run(b.id, () => approveBusiness(b.id, plan, Number(tables)));
              setApproving(false);
            }}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Confirm approve
          </button>
          <button
            onClick={() => setApproving(false)}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-zinc-500 hover:text-zinc-300"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function BusinessInfo({ b, menuBaseUrl }: { b: Business; menuBaseUrl?: string }) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/business/${b.id}`} className="font-bold hover:underline">
          {b.name}
        </Link>
        <Tag>{b.type}</Tag>
        {b.is_demo && <Tag>demo</Tag>}
      </div>
      <p className="mt-0.5 truncate text-xs text-zinc-500">
        {b.owner_email ?? "no owner"} · WA {b.whatsapp_number} ·{" "}
        {menuBaseUrl ? (
          <a
            href={`${menuBaseUrl}/m/${b.slug}`}
            target="_blank"
            rel="noreferrer"
            className="text-zinc-400 underline hover:text-white"
          >
            /m/{b.slug}
          </a>
        ) : (
          <>/m/{b.slug}</>
        )}
        {b.city ? <> · {b.city}</> : null}
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-1.5">
      <dt className="shrink-0 font-semibold text-zinc-600">{label}:</dt>
      <dd className="truncate">{children}</dd>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold uppercase text-zinc-400">
      {children}
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-zinc-800 py-8 text-center text-sm text-zinc-500">
      {children}
    </p>
  );
}
