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
import DialogModal from "../../_components/DialogModal";

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

  // Custom Modal configuration state
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "confirm" | "prompt";
    placeholder?: string;
    okLabel?: string;
    isDestructive?: boolean;
    action: (inputValue?: string) => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "confirm",
    action: () => {},
  });

  const showModal = (config: Omit<typeof modalConfig, "isOpen">) => {
    setModalConfig({ ...config, isOpen: true });
  };

  const run = (action: () => Promise<ActionResult>, okText = "Changes Saved") => {
    setMsg(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    startTransition(async () => {
      const res = await action();
      setMsg(res.ok ? { ok: true, text: okText } : { ok: false, text: res.error });
    });
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {msg && (
        <div
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm animate-fade-in ${
            msg.ok
              ? "bg-success-bg border-success/20 text-success"
              : "bg-danger-bg border-danger/20 text-danger"
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="size-5 shrink-0"
          >
            {msg.ok ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            )}
          </svg>
          <p className="font-semibold">{msg.text}</p>
        </div>
      )}

      <StatusControls b={business} pending={pending} run={run} showModal={showModal} />
      <InfoEditor b={business} pending={pending} run={run} />
      <FeaturesEditor b={business} f={features} pending={pending} run={run} />
      <OwnerAndDemo b={business} pending={pending} run={run} />
      <TestimonialsAdmin
        businessId={business.id}
        testimonials={testimonials}
        pending={pending}
        run={run}
        showModal={showModal}
      />

      {/* Custom Reusable Dialog Modal */}
      <DialogModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        placeholder={modalConfig.placeholder}
        okLabel={modalConfig.okLabel}
        isDestructive={modalConfig.isDestructive}
        onConfirm={(val) => {
          modalConfig.action(val);
          setModalConfig((p) => ({ ...p, isOpen: false }));
        }}
        onCancel={() => setModalConfig((p) => ({ ...p, isOpen: false }))}
      />
    </div>
  );
}

type RunFn = (action: () => Promise<ActionResult>, okText?: string) => void;
type ShowModalFn = (config: {
  title: string;
  message: string;
  type: "confirm" | "prompt";
  placeholder?: string;
  okLabel?: string;
  isDestructive?: boolean;
  action: (inputValue?: string) => void;
}) => void;

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function StatusControls({
  b,
  pending,
  run,
  showModal,
}: {
  b: Business;
  pending: boolean;
  run: RunFn;
  showModal: ShowModalFn;
}) {
  const [plan, setPlan] = useState<Plan>("free");
  const [tables, setTables] = useState("10");

  const getStatusColor = () => {
    switch (b.status) {
      case "approved":
        return "text-success bg-success-bg border-success/20";
      case "suspended":
        return "text-danger bg-danger-bg border-danger/20";
      case "rejected":
        return "text-muted bg-muted-bg border-border/80";
      default:
        return "text-warning bg-warning-bg border-warning/20";
    }
  };

  return (
    <Card
      title="Business Lifecycle & Status"
      icon={
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-4 text-muted">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 3.03v.568c0 .334.148.65.405.864l.406.34a2.203 2.203 0 0 0 2.247.333l.203-.102a1.442 1.442 0 0 1 1.942.668l.258.55a1.442 1.442 0 0 1-.668 1.942l-.203.102a2.203 2.203 0 0 0-.333 2.247l.34.406c.213.257.285.57.285.902v.062c0 .329-.072.65-.285.902l-.34.406a2.203 2.203 0 0 0 .333 2.247l.203.102a1.442 1.442 0 0 1 .668 1.942l-.258.55a1.442 1.442 0 0 1-1.942.668l-.203-.102a2.203 2.203 0 0 0-2.247-.333l-.406.34a1.443 1.443 0 0 1-.864.405h-.568a1.443 1.443 0 0 1-.864-.405l-.406-.34a2.203 2.203 0 0 0-2.247-.333l-.203.102a1.442 1.442 0 0 1-1.942-.668l-.258-.55a1.442 1.442 0 0 1 .668-1.942l.203-.102a2.203 2.203 0 0 0 .333-2.247l-.34-.406A1.441 1.441 0 0 1 3 11.25V11.1c.01-.33.083-.65.285-.902l.34-.406a2.203 2.203 0 0 0-.333-2.247l-.203-.102a1.442 1.442 0 0 1-.668-1.942l.258-.55a1.442 1.442 0 0 1 1.942-.668l.203.102a2.203 2.203 0 0 0 2.247.333l.406-.34a1.442 1.442 0 0 1 .864-.405h.568Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      }
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-foreground">Current State:</span>
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${getStatusColor()}`}>
            {b.status}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {b.status === "pending" && (
          <div className="w-full flex flex-wrap items-end gap-4 rounded-xl border border-warning/20 bg-warning-bg/5 p-4 mb-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Activation Plan</label>
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value as Plan)}
                className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground outline-none focus:border-primary"
              >
                <option value="free">Free Tier — 30 menu items</option>
                <option value="basic">Basic Tier — Photos, 100 items</option>
                <option value="premium">Premium Tier — All, 500 items</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Tables</label>
              <input
                type="number"
                min={0}
                max={200}
                value={tables}
                onChange={(e) => setTables(e.target.value)}
                className="w-24 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground outline-none focus:border-primary"
              />
            </div>
            <button
              disabled={pending}
              onClick={() => run(() => approveBusiness(b.id, plan, Number(tables)), "Business Approved & Activated")}
              className="rounded-xl bg-success hover:bg-success/90 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              Approve Request
            </button>
          </div>
        )}

        {b.status === "approved" && (
          <button
            disabled={pending}
            onClick={() => {
              showModal({
                title: "Suspend Account",
                message: "Owner will be locked out and pages de-activated. Please enter a suspension reason:",
                type: "prompt",
                placeholder: "Suspension reason...",
                okLabel: "Suspend Account",
                isDestructive: true,
                action: (reason) => {
                  if (reason?.trim()) run(() => suspendBusiness(b.id, reason), "Business Suspended");
                },
              });
            }}
            className="rounded-xl border border-danger/30 hover:border-danger bg-card hover:bg-danger-bg px-5 py-2.5 text-xs font-bold text-danger transition-all cursor-pointer disabled:opacity-50"
          >
            Suspend Account
          </button>
        )}

        {b.status === "suspended" && (
          <button
            disabled={pending}
            onClick={() => run(() => reactivateBusiness(b.id), "Business Reactivated")}
            className="rounded-xl bg-success hover:bg-success/90 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            Reactivate Account
          </button>
        )}

        {(b.status === "pending" || b.status === "approved" || b.status === "suspended") && (
          <button
            disabled={pending}
            onClick={() => {
              showModal({
                title: "Reject Application",
                message: "Please enter the rejection notes to save in admin files:",
                type: "prompt",
                placeholder: "Rejection reason...",
                okLabel: "Reject Application",
                isDestructive: true,
                action: (reason) => {
                  if (reason?.trim()) run(() => rejectBusiness(b.id, reason), "Application Rejected");
                },
              });
            }}
            className="rounded-xl border border-border hover:border-muted bg-card hover:bg-muted-bg px-5 py-2.5 text-xs font-bold text-muted hover:text-foreground transition-all cursor-pointer disabled:opacity-50"
          >
            Reject Application
          </button>
        )}

        {b.status === "rejected" && (
          <button
            disabled={pending}
            onClick={() => {
              showModal({
                title: "Delete Registry Permanently?",
                message: "This will completely delete the business entry. The owner can re-apply using their credentials.",
                type: "confirm",
                okLabel: "Delete Permanently",
                isDestructive: true,
                action: () => {
                  run(() => deleteRejectedBusiness(b.id), "Business Deleted");
                },
              });
            }}
            className="rounded-xl border border-danger/30 hover:border-danger bg-card hover:bg-danger-bg px-5 py-2.5 text-xs font-bold text-danger transition-all cursor-pointer disabled:opacity-50"
          >
            Delete Permanently
          </button>
        )}
      </div>
    </Card>
  );
}

function InputField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
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
    <Card
      title="Application Profile Information"
      icon={
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-4 text-muted">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm-1.215 3.021A5.278 5.278 0 0 1 10.25 15H4.25v-.375c0-1.026.833-1.875 1.875-1.875h.188a3.75 3.75 0 0 0 2.723 1.125Z" />
        </svg>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <InputField label="Business Name" value={f.name} onChange={set("name")} />
        <InputField label="Tagline" value={f.tagline} onChange={set("tagline")} />
        <InputField label="WhatsApp Number" value={f.whatsapp_number} onChange={set("whatsapp_number")} />
        <InputField label="Opening Hours" value={f.opening_hours} onChange={set("opening_hours")} />
        <InputField label="Owner Full Name" value={f.owner_name} onChange={set("owner_name")} />
        <InputField label="Owner Phone" value={f.owner_phone} onChange={set("owner_phone")} />
        <InputField label="Street Address" value={f.address} onChange={set("address")} />
        <InputField label="City" value={f.city} onChange={set("city")} />
        <InputField label="Pincode" value={f.pincode} onChange={set("pincode")} />
        <InputField label="GST Number" value={f.gst_number} onChange={set("gst_number")} />
      </div>
      <label className="mt-4 flex flex-col gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Admin Notes (Private - Never shared with business owner)</span>
        <textarea
          value={f.admin_notes}
          onChange={(e) => set("admin_notes")(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
        />
      </label>
      <button
        disabled={pending}
        onClick={() => run(() => updateBusinessInfo(b.id, f), "Information updated successfully")}
        className="mt-4 rounded-xl bg-primary hover:bg-primary-hover px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-sm transition-all cursor-pointer disabled:opacity-50"
      >
        Save Profile Info
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
    qr_download_enabled: f.qr_download_enabled,
    max_menu_items: f.max_menu_items,
  });

  const [activePreset, setActivePreset] = useState<Plan | null>(b.plan);

  const toggle = (k: keyof FeaturesInput) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setState((p) => ({ ...p, [k]: e.target.checked }));
    setActivePreset(null); // break preset sync
  };

  const applyPreset = (plan: Plan) => {
    setState((p) => ({
      ...p,
      ...PRESETS[plan],
      ordering_enabled: true,
      testimonials_enabled: true,
      tables_enabled: true,
    }));
    setActivePreset(plan);
  };

  const flags: [keyof FeaturesInput, string, string][] = [
    ["ordering_enabled", "Digital Ordering", "Enables QR-code order placements by clients"],
    ["testimonials_enabled", "Testimonials moderation", "Enable and moderate star ratings/reviews"],
    ["photos_enabled", "Menu Photos Support", "Allows menu items to upload and display image files"],
    ["analytics_enabled", "Dashboard Analytics", "Unlocks analytical reports and scans logs for owner"],
    ["tables_enabled", "Tables Management Grid", "Enables floorplan structure and QR associations"],
    ["qr_download_enabled", "Owner QR Download", "Lets the owner download their own table QR pack"],
  ];

  return (
    <Card
      title="Plan Tier & Features Editor"
      icon={
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-4 text-muted">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
        </svg>
      }
    >
      {/* Preset Plan Selectors */}
      <div className="mb-6">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-2.5">Quick Plan Presets</span>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(["free", "basic", "premium"] as Plan[]).map((p) => {
            const isActive = activePreset === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => applyPreset(p)}
                className={`flex flex-col text-left p-4 rounded-xl border transition-all cursor-pointer ${
                  isActive
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border bg-card hover:bg-muted-bg/30"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-extrabold uppercase tracking-wide text-foreground">
                    {p} preset
                  </span>
                  {isActive && (
                    <span className="size-2 rounded-full bg-primary" />
                  )}
                </div>
                <span className="mt-1 text-[10px] text-muted">
                  {p === "free" ? "30 menu items cap, standard features" : p === "basic" ? "100 menu items, photo uploads" : "500 items, all analytics unlocked"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Feature checkboxes */}
      <div className="space-y-3.5 border-t border-border/60 pt-4 mb-4">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-2">Configure Features</span>
        {flags.map(([key, label, desc]) => (
          <label key={key} className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={Boolean(state[key])}
              onChange={toggle(key)}
              className="mt-0.5 size-4 rounded border-border text-primary focus:ring-primary accent-primary cursor-pointer"
            />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">{label}</span>
              <span className="text-[10px] text-muted leading-relaxed">{desc}</span>
            </div>
          </label>
        ))}

        <div className="flex flex-col gap-1.5 border-t border-border/60 pt-4 mt-2">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Max Allowed Menu Items</label>
          <input
            type="number"
            min={1}
            max={5000}
            value={state.max_menu_items}
            onChange={(e) => {
              setState((p) => ({ ...p, max_menu_items: Number(e.target.value) }));
              setActivePreset(null);
            }}
            className="w-28 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground outline-none focus:border-primary"
          />
        </div>
      </div>

      <button
        disabled={pending}
        onClick={() => run(() => updateFeatures(b.id, state), "Features updated successfully")}
        className="rounded-xl bg-primary hover:bg-primary-hover px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-sm transition-all cursor-pointer disabled:opacity-50"
      >
        Save Feature Flags
      </button>
      <p className="mt-2 text-[10px] text-muted italic">
        Preset selectors adjust the checkboxes instantly. Save flags to commit updates. Use Lifecycle lifecycle panel to update Plan tier label.
      </p>
    </Card>
  );
}

function OwnerAndDemo({ b, pending, run }: { b: Business; pending: boolean; run: RunFn }) {
  const [email, setEmail] = useState("");
  return (
    <Card
      title="Ownership & Environment Settings"
      icon={
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-4 text-muted">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
        </svg>
      }
    >
      <div className="flex flex-col gap-4 border-b border-border/60 pb-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted">Owner account email:</span>
          <span className="text-xs font-extrabold text-foreground bg-muted-bg/60 border border-border/60 px-2.5 py-1 rounded-lg">
            {b.owner_email ?? "No Linked Account"}
          </span>
        </div>

        <div className="flex flex-wrap items-end gap-3 max-w-lg">
          <div className="flex-1 min-w-[200px]">
            <InputField label="Re-link Account Owner (Email)" value={email} onChange={setEmail} />
          </div>
          <button
            disabled={pending || !email.trim()}
            onClick={() => {
              run(() => linkOwnerByEmail(b.id, email), "Owner account re-linked");
              setEmail("");
            }}
            className="rounded-xl border border-border hover:bg-muted-bg hover:border-muted/60 px-4 py-2.5 text-xs font-bold text-foreground transition-all cursor-pointer disabled:opacity-50"
          >
            Re-link Owner
          </button>
        </div>
      </div>

      <label className="flex items-center gap-3 cursor-pointer group">
        <input
          type="checkbox"
          checked={b.is_demo}
          onChange={(e) => run(() => setDemo(b.id, e.target.checked), "Demo environment state toggled")}
          disabled={pending}
          className="size-4 rounded border-border text-warning focus:ring-warning accent-warning cursor-pointer"
        />
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-bold text-foreground group-hover:text-warning transition-colors">Flag as Demo Environment</span>
          <span className="text-[10px] text-muted">Demo businesses and their transaction values are completely excluded from platform statistics and charts metrics.</span>
        </div>
      </label>
    </Card>
  );
}

function TestimonialsAdmin({
  businessId,
  testimonials,
  pending,
  run,
  showModal,
}: {
  businessId: string;
  testimonials: Testimonial[];
  pending: boolean;
  run: RunFn;
  showModal: ShowModalFn;
}) {
  return (
    <Card
      title={`Customer Testimonials (${testimonials.length})`}
      icon={
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-4 text-muted">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
        </svg>
      }
    >
      {testimonials.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted">No testimonials registered for this business.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {testimonials.map((t) => (
            <li
              key={t.id}
              className="flex items-start justify-between gap-4 rounded-xl border border-border bg-background p-4 shadow-sm"
            >
              <div className="min-w-0">
                <div className="flex items-center flex-wrap gap-2">
                  <span className="text-xs font-bold text-foreground">{t.customer_name}</span>
                  <span className="text-amber-500 font-bold tracking-wide text-xs">
                    {"★".repeat(t.rating)}
                    {"☆".repeat(5 - t.rating)}
                  </span>
                  <span className={`inline-flex rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase border ${
                    t.status === "approved"
                      ? "bg-success-bg border-success/20 text-success"
                      : t.status === "pending"
                        ? "bg-warning-bg border-warning/20 text-warning"
                        : "bg-muted-bg border-border/80 text-muted"
                  }`}>
                    {t.status}
                  </span>
                </div>
                <blockquote className="mt-2 text-xs text-muted italic leading-relaxed">
                  &ldquo;{t.text}&rdquo;
                </blockquote>
              </div>
              <button
                disabled={pending}
                onClick={() => {
                  showModal({
                    title: "Delete Testimonial?",
                    message: "Are you sure you want to permanently delete this testimonial? Removal is audited and recorded.",
                    type: "confirm",
                    okLabel: "Delete Testimonial",
                    isDestructive: true,
                    action: () => {
                      run(() => deleteTestimonial(t.id, businessId, t.text), "Testimonial deleted successfully");
                    },
                  });
                }}
                className="shrink-0 rounded-xl border border-danger/30 hover:border-danger bg-card hover:bg-danger-bg px-3.5 py-2 text-xs font-bold text-danger transition-all cursor-pointer disabled:opacity-50"
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
