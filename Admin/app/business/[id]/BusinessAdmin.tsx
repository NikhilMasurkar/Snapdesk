"use client";

import { useState, useTransition } from "react";
import type { Business, BusinessFeatures, Testimonial } from "@/lib/types";
import {
  approveBusiness,
  deleteRejectedBusiness,
  deleteTestimonial,
  linkOwnerByEmail,
  reactivateBusiness,
  rejectBusiness,
  setDemo,
  suspendBusiness,
  updateBusinessInfo,
  updateFeatures,
  type ActionResult,
  type BusinessInfoInput,
  type FeaturesInput,
  type Plan,
} from "../../actions";

export default function BusinessAdmin({
  business,
  features,
  testimonials,
}: {
  business: Business;
  features: BusinessFeatures;
  testimonials: Testimonial[];
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = (action: () => Promise<ActionResult>, okText = "Saved") => {
    setMsg(null);
    startTransition(async () => {
      const res = await action();
      setMsg(res.ok ? { ok: true, text: okText } : { ok: false, text: res.error });
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {msg && (
        <p
          className={`rounded-lg px-4 py-2 text-sm ${
            msg.ok ? "bg-emerald-950 text-emerald-300" : "bg-red-950 text-red-300"
          }`}
        >
          {msg.text}
        </p>
      )}

      <StatusControls b={business} pending={pending} run={run} />
      <InfoEditor b={business} pending={pending} run={run} />
      <FeaturesEditor b={business} f={features} pending={pending} run={run} />
      <OwnerAndDemo b={business} pending={pending} run={run} />
      <TestimonialsAdmin
        businessId={business.id}
        testimonials={testimonials}
        pending={pending}
        run={run}
      />
    </div>
  );
}

type RunFn = (action: () => Promise<ActionResult>, okText?: string) => void;

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

function StatusControls({ b, pending, run }: { b: Business; pending: boolean; run: RunFn }) {
  const [plan, setPlan] = useState<Plan>("free");
  const [tables, setTables] = useState("10");

  return (
    <Card title={`Status — ${b.status}`}>
      <div className="flex flex-wrap items-end gap-3">
        {b.status === "pending" && (
          <>
            <label className="text-xs font-semibold text-zinc-400">
              Plan
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value as Plan)}
                className="mt-1 block rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-white"
              >
                <option value="free">Free — 30 items</option>
                <option value="basic">Basic — photos, 100 items</option>
                <option value="premium">Premium — all, 500 items</option>
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
                className="mt-1 block w-24 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-white"
              />
            </label>
            <button
              disabled={pending}
              onClick={() => run(() => approveBusiness(b.id, plan, Number(tables)), "Approved")}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Approve
            </button>
          </>
        )}

        {b.status === "approved" && (
          <button
            disabled={pending}
            onClick={() => {
              const reason = window.prompt("Suspend — reason (owner locked out, page dark):");
              if (reason?.trim()) run(() => suspendBusiness(b.id, reason), "Suspended");
            }}
            className="rounded-lg border border-red-900 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-950 disabled:opacity-50"
          >
            Suspend
          </button>
        )}

        {b.status === "suspended" && (
          <button
            disabled={pending}
            onClick={() => run(() => reactivateBusiness(b.id), "Reactivated")}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Reactivate
          </button>
        )}

        {(b.status === "pending" || b.status === "approved" || b.status === "suspended") && (
          <button
            disabled={pending}
            onClick={() => {
              const reason = window.prompt("Reject — reason (saved to admin notes):");
              if (reason?.trim()) run(() => rejectBusiness(b.id, reason), "Rejected");
            }}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-400 hover:bg-zinc-800 disabled:opacity-50"
          >
            Reject
          </button>
        )}

        {b.status === "rejected" && (
          <button
            disabled={pending}
            onClick={() => {
              if (window.confirm("Delete permanently? The owner can re-apply."))
                run(() => deleteRejectedBusiness(b.id), "Deleted");
            }}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-400 hover:bg-zinc-800 disabled:opacity-50"
          >
            Delete permanently
          </button>
        )}
      </div>
    </Card>
  );
}

function Text({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="text-xs font-semibold text-zinc-400">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm text-white"
      />
    </label>
  );
}

function InfoEditor({ b, pending, run }: { b: Business; pending: boolean; run: RunFn }) {
  const [f, setF] = useState<BusinessInfoInput>({
    name: b.name,
    tagline: b.tagline ?? "",
    whatsapp_number: b.whatsapp_number,
    owner_name: b.owner_name ?? "",
    owner_phone: b.owner_phone ?? "",
    address: b.address ?? "",
    city: b.city ?? "",
    pincode: b.pincode ?? "",
    gst_number: b.gst_number ?? "",
    opening_hours: b.opening_hours ?? "",
    admin_notes: b.admin_notes ?? "",
  });
  const set = (k: keyof BusinessInfoInput) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  return (
    <Card title="Application info">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Text label="Business name" value={f.name} onChange={set("name")} />
        <Text label="Tagline" value={f.tagline} onChange={set("tagline")} />
        <Text label="WhatsApp" value={f.whatsapp_number} onChange={set("whatsapp_number")} />
        <Text label="Opening hours" value={f.opening_hours} onChange={set("opening_hours")} />
        <Text label="Owner name" value={f.owner_name} onChange={set("owner_name")} />
        <Text label="Owner phone" value={f.owner_phone} onChange={set("owner_phone")} />
        <Text label="Address" value={f.address} onChange={set("address")} />
        <Text label="City" value={f.city} onChange={set("city")} />
        <Text label="Pincode" value={f.pincode} onChange={set("pincode")} />
        <Text label="GST number" value={f.gst_number} onChange={set("gst_number")} />
      </div>
      <label className="mt-3 block text-xs font-semibold text-zinc-400">
        Admin notes (private — never shown to the owner)
        <textarea
          value={f.admin_notes}
          onChange={(e) => set("admin_notes")(e.target.value)}
          rows={2}
          className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm text-white"
        />
      </label>
      <button
        disabled={pending}
        onClick={() => run(() => updateBusinessInfo(b.id, f), "Info saved")}
        className="mt-3 rounded-lg bg-white px-4 py-2 text-xs font-bold text-zinc-950 hover:bg-zinc-200 disabled:opacity-50"
      >
        Save info
      </button>
    </Card>
  );
}

const PRESETS: Record<Plan, Partial<FeaturesInput>> = {
  free: { photos_enabled: false, analytics_enabled: false, max_menu_items: 30 },
  basic: { photos_enabled: true, analytics_enabled: false, max_menu_items: 100 },
  premium: { photos_enabled: true, analytics_enabled: true, max_menu_items: 500 },
};

function FeaturesEditor({
  b,
  f,
  pending,
  run,
}: {
  b: Business;
  f: BusinessFeatures;
  pending: boolean;
  run: RunFn;
}) {
  const [state, setState] = useState<FeaturesInput>({
    ordering_enabled: f.ordering_enabled,
    testimonials_enabled: f.testimonials_enabled,
    photos_enabled: f.photos_enabled,
    analytics_enabled: f.analytics_enabled,
    tables_enabled: f.tables_enabled,
    max_menu_items: f.max_menu_items,
  });
  const toggle = (k: keyof FeaturesInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setState((p) => ({ ...p, [k]: e.target.checked }));

  const applyPreset = (plan: Plan) =>
    setState((p) => ({ ...p, ...PRESETS[plan], ordering_enabled: true, testimonials_enabled: true, tables_enabled: true }));

  const flags: [keyof FeaturesInput, string][] = [
    ["ordering_enabled", "Ordering"],
    ["testimonials_enabled", "Testimonials"],
    ["photos_enabled", "Photos"],
    ["analytics_enabled", "Analytics"],
    ["tables_enabled", "Tables grid"],
  ];

  return (
    <Card title={`Plan & features — currently ${b.plan}`}>
      <div className="mb-3 flex gap-2">
        {(["free", "basic", "premium"] as Plan[]).map((p) => (
          <button
            key={p}
            onClick={() => applyPreset(p)}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
          >
            {p} preset
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {flags.map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={Boolean(state[key])}
              onChange={toggle(key)}
              className="size-4 accent-emerald-500"
            />
            {label}
          </label>
        ))}
        <label className="mt-1 text-xs font-semibold text-zinc-400">
          Max menu items
          <input
            type="number"
            min={1}
            max={5000}
            value={state.max_menu_items}
            onChange={(e) =>
              setState((p) => ({ ...p, max_menu_items: Number(e.target.value) }))
            }
            className="mt-1 block w-28 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-white"
          />
        </label>
      </div>
      <button
        disabled={pending}
        onClick={() => run(() => updateFeatures(b.id, state), "Features saved")}
        className="mt-3 rounded-lg bg-white px-4 py-2 text-xs font-bold text-zinc-950 hover:bg-zinc-200 disabled:opacity-50"
      >
        Save features
      </button>
      <p className="mt-2 text-[11px] text-zinc-600">
        Note: presets set feature flags here; use the Approve dialog to change the
        stored plan label.
      </p>
    </Card>
  );
}

function OwnerAndDemo({ b, pending, run }: { b: Business; pending: boolean; run: RunFn }) {
  const [email, setEmail] = useState("");
  return (
    <Card title="Owner & demo">
      <p className="mb-2 text-sm text-zinc-400">
        Owner: <span className="text-zinc-200">{b.owner_email ?? "not linked"}</span>
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs font-semibold text-zinc-400">
          Re-link owner by email
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="owner@example.com"
            className="mt-1 block w-64 rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm text-white"
          />
        </label>
        <button
          disabled={pending || !email.trim()}
          onClick={() => run(() => linkOwnerByEmail(b.id, email), "Owner re-linked")}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
        >
          Re-link
        </button>
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm text-zinc-300">
        <input
          type="checkbox"
          checked={b.is_demo}
          onChange={(e) => run(() => setDemo(b.id, e.target.checked), "Demo flag updated")}
          disabled={pending}
          className="size-4 accent-amber-500"
        />
        Demo business (excluded from platform revenue & stats)
      </label>
    </Card>
  );
}

function TestimonialsAdmin({
  businessId,
  testimonials,
  pending,
  run,
}: {
  businessId: string;
  testimonials: Testimonial[];
  pending: boolean;
  run: RunFn;
}) {
  return (
    <Card title={`Testimonials (${testimonials.length})`}>
      {testimonials.length === 0 ? (
        <p className="text-sm text-zinc-600">No testimonials.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {testimonials.map((t) => (
            <li
              key={t.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3"
            >
              <div className="min-w-0">
                <p className="text-sm">
                  <span className="font-semibold">{t.customer_name}</span>{" "}
                  <span className="text-amber-400">{"★".repeat(t.rating)}</span>{" "}
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase text-zinc-400">
                    {t.status}
                  </span>
                </p>
                <p className="mt-1 text-xs text-zinc-400">{t.text}</p>
              </div>
              <button
                disabled={pending}
                onClick={() => {
                  if (window.confirm("Permanently delete this testimonial? (Audited.)"))
                    run(() => deleteTestimonial(t.id, businessId, t.text), "Testimonial deleted");
                }}
                className="shrink-0 rounded-lg border border-red-900 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-950 disabled:opacity-50"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
