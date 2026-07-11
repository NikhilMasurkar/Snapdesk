"use client";

import { useState, useTransition } from "react";
import type { Business, BusinessFeatures } from "@/lib/types";
import {
  approveBusiness,
  deleteRejectedBusiness,
  linkOwnerByEmail,
  reactivateBusiness,
  rejectBusiness,
  setDemo,
  suspendBusiness,
  updateBusinessInfo,
  updateFeatures,
  updateTableCount,
  type ActionResult,
  type BusinessInfoInput,
  type FeaturesInput,
  type Plan,
} from "../../actions";
import DialogModal from "../../_components/DialogModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import QrPackButton from "./QrPackButton";

export default function BusinessAdmin({
  business,
  features,
}: {
  business: Business;
  features: BusinessFeatures;
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

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
    <div className="flex flex-col gap-8 w-full">
      {msg && (
        <div
          className={`flex items-center gap-3 rounded-2xl border px-5 py-4 text-sm font-semibold animate-fade-in shadow-xs ${
            msg.ok
              ? "bg-success-bg border-success/30 text-success"
              : "bg-danger-bg border-danger/30 text-danger"
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-5 shrink-0">
            {msg.ok ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            )}
          </svg>
          <p>{msg.text}</p>
        </div>
      )}

      <StatusControls b={business} pending={pending} run={run} showModal={showModal} />
      <InfoEditor b={business} pending={pending} run={run} />
      <FeaturesEditor b={business} f={features} pending={pending} run={run} />
      <OwnerAndDemo b={business} pending={pending} run={run} />

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
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all">
      <div className="mb-5 flex items-start justify-between border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {icon}
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-foreground tracking-tight">{title}</h2>
            {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
          </div>
        </div>
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
  const [plan, setPlan] = useState<Plan>(b.plan || "free");
  const [tables, setTables] = useState(String(b.table_count || 10));

  const getStatusBanner = () => {
    switch (b.status) {
      case "approved":
        return {
          title: "Account Approved & Active",
          desc: "This business is live on Snapdesk. Customers can access the digital menu and place orders.",
          badgeClass: "bg-success-bg text-success border-success/30",
        };
      case "suspended":
        return {
          title: "Account Suspended",
          desc: "The owner is locked out and live pages are deactivated.",
          badgeClass: "bg-danger-bg text-danger border-danger/30",
        };
      case "rejected":
        return {
          title: "Application Rejected",
          desc: "This application was rejected.",
          badgeClass: "bg-muted-bg text-muted border-border",
        };
      default:
        return {
          title: "Pending Approval Queue",
          desc: "Review application details and assign an activation plan below.",
          badgeClass: "bg-warning-bg text-warning border-warning/30",
        };
    }
  };

  const banner = getStatusBanner();

  return (
    <Card
      title="Lifecycle & Status Console"
      subtitle="Manage account status, activation plans, and suspension state"
      icon={
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Status Explanation Box */}
        <div className="flex items-center justify-between rounded-xl border border-border bg-background p-4">
          <div>
            <h3 className="text-xs font-bold text-foreground">{banner.title}</h3>
            <p className="text-xs text-muted mt-0.5">{banner.desc}</p>
          </div>
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-extrabold uppercase tracking-wider ${banner.badgeClass}`}>
            {b.status}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-end gap-3 pt-2">
          {b.status === "pending" && (
            <div className="w-full flex flex-col sm:flex-row sm:items-end gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex-1 flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Activation Plan</label>
                <Select value={plan} onValueChange={(v) => setPlan(v as Plan)}>
                  <SelectTrigger className="rounded-xl bg-card text-xs font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free Tier — 30 menu items</SelectItem>
                    <SelectItem value="basic">Basic Tier — Photos, 100 items</SelectItem>
                    <SelectItem value="premium">Premium Tier — All Features, 500 items</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-28 flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Tables</label>
                <Input
                  type="number"
                  min={0}
                  max={200}
                  value={tables}
                  onChange={(e) => setTables(e.target.value)}
                  className="rounded-xl bg-card text-xs font-bold"
                />
              </div>
              <Button variant="ghost"
                disabled={pending}
                onClick={() => run(() => approveBusiness(b.id, plan, Number(tables)), "Business Approved & Activated")}
                className="h-auto rounded-xl bg-success hover:bg-success/90 px-6 py-2.5 text-xs font-bold text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                Approve & Activate
              </Button>
            </div>
          )}

          {b.status === "approved" && (
            <Button variant="ghost"
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
              className="h-auto rounded-xl border border-danger/30 hover:border-danger bg-card hover:bg-danger-bg px-5 py-2.5 text-xs font-bold text-danger transition-all cursor-pointer disabled:opacity-50"
            >
              Suspend Account
            </Button>
          )}

          {b.status === "suspended" && (
            <Button variant="ghost"
              disabled={pending}
              onClick={() => run(() => reactivateBusiness(b.id), "Business Reactivated")}
              className="h-auto rounded-xl bg-success hover:bg-success/90 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              Reactivate Account
            </Button>
          )}

          {(b.status === "pending" || b.status === "approved" || b.status === "suspended") && (
            <Button variant="ghost"
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
              className="h-auto rounded-xl border border-border hover:border-muted bg-card hover:bg-muted-bg px-5 py-2.5 text-xs font-bold text-muted hover:text-foreground transition-all cursor-pointer disabled:opacity-50"
            >
              Reject Application
            </Button>
          )}

          {b.status === "rejected" && (
            <Button variant="ghost"
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
              className="h-auto rounded-xl border border-danger/30 hover:border-danger bg-card hover:bg-danger-bg px-5 py-2.5 text-xs font-bold text-danger transition-all cursor-pointer disabled:opacity-50"
            >
              Delete Permanently
            </Button>
          )}
        </div>
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
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl text-xs font-semibold"
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
      subtitle="Manage brand identity, owner contact details, and location data"
      icon={
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm-1.215 3.021A5.278 5.278 0 0 1 10.25 15H4.25v-.375c0-1.026.833-1.875 1.875-1.875h.188a3.75 3.75 0 0 0 2.723 1.125Z" />
        </svg>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Section 1: Brand & Identity */}
        <div>
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-primary mb-3">Brand & Identity</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InputField label="Business Name" value={f.name} onChange={set("name")} />
            <InputField label="Tagline" value={f.tagline} onChange={set("tagline")} />
            <InputField label="WhatsApp Order Number" value={f.whatsapp_number} onChange={set("whatsapp_number")} />
            <InputField label="Opening Hours" value={f.opening_hours} onChange={set("opening_hours")} />
          </div>
        </div>

        {/* Section 2: Owner & Registration */}
        <div className="border-t border-border/60 pt-4">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-primary mb-3">Owner Contact & Location</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InputField label="Owner Full Name" value={f.owner_name} onChange={set("owner_name")} />
            <InputField label="Owner Phone" value={f.owner_phone} onChange={set("owner_phone")} />
            <InputField label="Street Address" value={f.address} onChange={set("address")} />
            <InputField label="City" value={f.city} onChange={set("city")} />
            <InputField label="Pincode" value={f.pincode} onChange={set("pincode")} />
            <InputField label="GST Number" value={f.gst_number} onChange={set("gst_number")} />
          </div>
        </div>

        {/* Section 3: Internal Notes */}
        <div className="border-t border-border/60 pt-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Internal Admin Notes (Private — Never shared with business owner)</span>
            <Textarea
              value={f.admin_notes}
              onChange={(e) => set("admin_notes")(e.target.value)}
              rows={3}
              className="w-full rounded-xl text-xs font-semibold"
            />
          </label>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="ghost"
            disabled={pending}
            onClick={() => run(() => updateBusinessInfo(b.id, f), "Profile information updated")}
            className="h-auto rounded-xl bg-primary hover:bg-primary-hover px-6 py-2.5 text-xs font-bold text-primary-foreground shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            Save Profile Changes
          </Button>
        </div>
      </div>
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

  const toggle = (k: keyof FeaturesInput) => (checked: boolean) => {
    setState((p) => ({ ...p, [k]: checked }));
    setActivePreset(null);
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
    ["ordering_enabled", "Digital Ordering", "Enables QR-code order placements by customers"],
    ["testimonials_enabled", "Customer Testimonials", "Enable star ratings and customer reviews"],
    ["photos_enabled", "Menu Photos Support", "Allow menu items to upload and display photo attachments"],
    ["analytics_enabled", "Dashboard Analytics", "Unlock analytical reports and scan logs for owner"],
    ["tables_enabled", "Tables Management", "Enable table floorplan grid and QR code management"],
    ["qr_download_enabled", "Owner QR Download", "Allow the owner to download table QR print packages"],
  ];

  return (
    <Card
      title="Feature Toggles & Plan Tier"
      subtitle="Control platform capabilities and limits assigned to this business"
      icon={
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
        </svg>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Preset Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-muted mr-2">Quick Presets:</span>
          {(["free", "basic", "premium"] as Plan[]).map((plan) => (
            <Button variant="ghost"
              key={plan}
              type="button"
              onClick={() => applyPreset(plan)}
              className={`h-auto rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                activePreset === plan
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-background border border-border text-foreground hover:bg-muted-bg"
              }`}
            >
              {plan.toUpperCase()}
            </Button>
          ))}
        </div>

        {/* Feature Switches */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {flags.map(([key, label, desc]) => {
            const checked = Boolean(state[key]);
            return (
              <label
                key={key}
                className={`flex items-start justify-between rounded-xl border p-4 transition-all cursor-pointer ${
                  checked ? "border-primary/40 bg-primary/5" : "border-border bg-background"
                }`}
              >
                <div>
                  <span className="text-xs font-bold text-foreground">{label}</span>
                  <p className="text-[11px] text-muted mt-0.5">{desc}</p>
                </div>
                <Switch checked={checked} onCheckedChange={toggle(key)} className="mt-0.5" />
              </label>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-border/60 pt-4">
          <label className="flex items-center gap-3">
            <span className="text-xs font-bold text-foreground">Max Menu Items:</span>
            <Input
              type="number"
              min={1}
              max={1000}
              value={state.max_menu_items}
              onChange={(e) => setState((p) => ({ ...p, max_menu_items: Number(e.target.value) }))}
              className="w-24 rounded-xl text-xs font-bold"
            />
          </label>

          <Button variant="ghost"
            disabled={pending}
            onClick={() => run(() => updateFeatures(f.business_id, state), "Feature configuration saved")}
            className="h-auto rounded-xl bg-primary hover:bg-primary-hover px-6 py-2.5 text-xs font-bold text-primary-foreground shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            Save Features
          </Button>
        </div>
      </div>
    </Card>
  );
}

function OwnerAndDemo({ b, pending, run }: { b: Business; pending: boolean; run: RunFn }) {
  const [email, setEmail] = useState(b.owner_email ?? "");

  return (
    <Card
      title="Owner Auth & Demo Status"
      subtitle="Link user authentication email and manage demo exclusion"
      icon={
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
        </svg>
      }
    >
      <div className="flex flex-col gap-6">
        <div>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Owner Auth Email (Supabase Account)</span>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="owner@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 rounded-xl text-xs font-semibold"
              />
              <Button variant="ghost"
                disabled={pending || !email.trim()}
                onClick={() => run(() => linkOwnerByEmail(b.id, email.trim()), "Owner email linked successfully")}
                className="h-auto rounded-xl bg-foreground hover:bg-foreground/90 px-4 py-2.5 text-xs font-bold text-background transition-all cursor-pointer disabled:opacity-50"
              >
                Link Email
              </Button>
            </div>
          </label>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border bg-background p-4">
          <div>
            <h4 className="text-xs font-bold text-foreground">Demo / Test Account Mode</h4>
            <p className="text-[11px] text-muted">Exclude from real platform revenue & analytics</p>
          </div>
          <Button variant="ghost"
            disabled={pending}
            onClick={() => run(() => setDemo(b.id, !b.is_demo), b.is_demo ? "Demo Mode Disabled" : "Demo Mode Enabled")}
            className={`h-auto rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
              b.is_demo
                ? "bg-warning text-warning-foreground"
                : "border border-border bg-card text-muted hover:text-foreground"
            }`}
          >
            {b.is_demo ? "Demo: ON" : "Demo: OFF"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function TableQrManager({
  business,
  menuBaseUrl,
}: {
  business: Business;
  menuBaseUrl: string;
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [count, setCount] = useState<number>(business.table_count || 10);

  const step = (delta: number) => {
    setCount((prev) => Math.max(0, Math.min(1000, prev + delta)));
  };

  const save = () => {
    setMsg(null);
    startTransition(async () => {
      const res = await updateTableCount(business.id, count);
      if (res.ok) {
        setMsg({ ok: true, text: `Table QR allocation updated to ${count} tables` });
      } else {
        setMsg({ ok: false, text: res.error });
      }
    });
  };

  return (
    <Card
      title="Table QR Code Allocation & Access"
      subtitle="Manage how many table QR codes are assigned to this business"
      icon={
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
        </svg>
      }
    >
      <div className="flex flex-col gap-5">
        {msg && (
          <div
            className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold animate-fade-in ${
              msg.ok
                ? "bg-success-bg border-success/30 text-success"
                : "bg-danger-bg border-danger/30 text-danger"
            }`}
          >
            <span>{msg.text}</span>
          </div>
        )}

        {/* Current Allocation Pill */}
        <div className="flex items-center justify-between rounded-xl border border-border bg-background p-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Allocated Table QR Codes</span>
            <p className="text-xl font-black text-foreground mt-0.5">{count} Tables</p>
          </div>
          <span className="inline-flex items-center rounded-full bg-primary/15 border border-primary/30 px-3 py-1 text-xs font-extrabold text-primary">
            {count} QR Active
          </span>
        </div>

        {/* Increment / Decrement Quick Controls */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-2">
            Adjust Table Allocation Access
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost"
              type="button"
              onClick={() => step(-5)}
              disabled={pending || count <= 0}
              className="h-auto rounded-xl border border-border bg-background hover:bg-muted-bg px-3 py-2 text-xs font-extrabold text-foreground transition-all cursor-pointer disabled:opacity-40"
            >
              -5
            </Button>
            <Button variant="ghost"
              type="button"
              onClick={() => step(-1)}
              disabled={pending || count <= 0}
              className="h-auto rounded-xl border border-border bg-background hover:bg-muted-bg px-3 py-2 text-xs font-extrabold text-foreground transition-all cursor-pointer disabled:opacity-40"
            >
              -1
            </Button>
            <Input
              type="number"
              min={0}
              max={1000}
              value={count}
              onChange={(e) => setCount(Math.max(0, Math.min(1000, Number(e.target.value) || 0)))}
              className="w-20 rounded-xl text-center text-xs font-black"
            />
            <Button variant="ghost"
              type="button"
              onClick={() => step(1)}
              disabled={pending}
              className="h-auto rounded-xl border border-border bg-background hover:bg-muted-bg px-3 py-2 text-xs font-extrabold text-foreground transition-all cursor-pointer disabled:opacity-40"
            >
              +1
            </Button>
            <Button variant="ghost"
              type="button"
              onClick={() => step(5)}
              disabled={pending}
              className="h-auto rounded-xl border border-border bg-background hover:bg-muted-bg px-3 py-2 text-xs font-extrabold text-foreground transition-all cursor-pointer disabled:opacity-40"
            >
              +5
            </Button>
            <Button variant="ghost"
              type="button"
              onClick={() => step(10)}
              disabled={pending}
              className="h-auto rounded-xl border border-border bg-background hover:bg-muted-bg px-3 py-2 text-xs font-extrabold text-foreground transition-all cursor-pointer disabled:opacity-40"
            >
              +10
            </Button>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <Button variant="ghost"
            type="button"
            onClick={save}
            disabled={pending || count === business.table_count}
            className="h-auto rounded-xl bg-primary hover:bg-primary-hover px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            Save Table Allocation
          </Button>
        </div>

        {/* Print Package Generator */}
        <div className="border-t border-border/60 pt-4">
          <p className="text-xs text-muted mb-3 leading-relaxed">
            Generate and download high-contrast A4 print-ready PDF containing QR stands for{" "}
            <span className="font-bold text-foreground">{count} tables</span>.
          </p>
          <QrPackButton
            slug={business.slug}
            businessName={business.name}
            tableCount={count}
            menuBaseUrl={menuBaseUrl}
          />
        </div>
      </div>
    </Card>
  );
}
