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
import DialogModal from "./_components/DialogModal";

type TabId = "all" | "pending" | "approved" | "suspended" | "rejected";

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
  const [activeTab, setActiveTab] = useState<TabId>("pending"); // Default to pending

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

  const filteredBusinesses = () => {
    switch (activeTab) {
      case "pending":
        return pending;
      case "approved":
        return approved;
      case "suspended":
        return suspended;
      case "rejected":
        return rejected;
      default:
        return businesses;
    }
  };

  const tabList: { id: TabId; label: string; count: number; activeColor: string }[] = [
    { id: "pending", label: "Pending Requests", count: pending.length, activeColor: "border-warning text-warning bg-warning-bg/10" },
    { id: "approved", label: "Approved", count: approved.length, activeColor: "border-success text-success bg-success-bg/10" },
    { id: "suspended", label: "Suspended", count: suspended.length, activeColor: "border-danger text-danger bg-danger-bg/10" },
    { id: "rejected", label: "Rejected", count: rejected.length, activeColor: "border-muted text-muted bg-muted-bg/50" },
    { id: "all", label: "All Businesses", count: businesses.length, activeColor: "border-primary text-primary bg-primary/5" },
  ];

  return (
    <div className="flex flex-col gap-6 w-full">
      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-danger-bg border border-danger/20 px-4 py-3 text-sm text-danger animate-fade-in">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="size-5 shrink-0"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
            />
          </svg>
          <p className="font-semibold">{error}</p>
        </div>
      )}

      {/* Tabs Layout */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-px overflow-x-auto">
        {tabList.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                isActive
                  ? `${tab.activeColor} border-current`
                  : "border-transparent text-muted hover:text-foreground hover:bg-muted-bg/30"
              }`}
            >
              {tab.label}
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                  isActive
                    ? "bg-foreground/10 text-current"
                    : "bg-muted-bg text-muted"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Dynamic Queue Content */}
      <div className="space-y-4">
        {filteredBusinesses().length === 0 ? (
          <EmptyState tab={activeTab} />
        ) : (
          filteredBusinesses().map((b) => {
            if (b.status === "pending") {
              return (
                <PendingCard
                  key={b.id}
                  b={b}
                  busy={busyId === b.id}
                  run={run}
                  showModal={showModal}
                />
              );
            }
            return (
              <RegularCard
                key={b.id}
                b={b}
                busy={busyId === b.id}
                run={run}
                menuBaseUrl={menuBaseUrl}
                showModal={showModal}
              />
            );
          })
        )}
      </div>

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

/** Component for Render Empty State */
function EmptyState({ tab }: { tab: TabId }) {
  const getMessage = () => {
    switch (tab) {
      case "pending":
        return { title: "Clear Queue", desc: "No pending applications to review right now." };
      case "approved":
        return { title: "No Approved Businesses", desc: "No businesses have been approved yet." };
      case "suspended":
        return { title: "All Quiet Here", desc: "No suspended accounts on the platform." };
      case "rejected":
        return { title: "Empty Registry", desc: "No rejected applications in the database." };
      default:
        return { title: "No Registry Records", desc: "No businesses registered on the system." };
    }
  };

  const msg = getMessage();

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-12 px-4 text-center bg-card/30">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="size-10 text-muted mb-3"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m8.25-3v13.5m0-13.5L12 3m0 1.5H8.25m3.75 0h3.75"
        />
      </svg>
      <h3 className="text-sm font-bold text-foreground">{msg.title}</h3>
      <p className="mt-1 text-xs text-muted max-w-xs">{msg.desc}</p>
    </div>
  );
}

/** Detail Key/Value grid item */
function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</dt>
      <dd className="text-xs font-medium text-foreground truncate" title={String(children)}>
        {children || "—"}
      </dd>
    </div>
  );
}

/** Pending application card with custom interactive Approve Form */
function PendingCard({
  b,
  busy,
  run,
  showModal,
}: {
  b: Business;
  busy: boolean;
  run: (id: string, action: () => Promise<ActionResult>) => void;
  showModal: (config: {
    title: string;
    message: string;
    type: "confirm" | "prompt";
    placeholder?: string;
    okLabel?: string;
    isDestructive?: boolean;
    action: (inputValue?: string) => void;
  }) => void;
}) {
  const [approving, setApproving] = useState(false);
  const [plan, setPlan] = useState<Plan>("free");
  const [tables, setTables] = useState("10");

  return (
    <div className="rounded-2xl border border-warning/20 bg-card p-5 shadow-sm hover:shadow-md hover:border-warning/40 transition-all">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Link href={`/business/${b.id}`} className="text-base font-bold text-foreground hover:text-primary transition-colors hover:underline">
              {b.name}
            </Link>
            <span className="inline-flex items-center rounded-full bg-muted-bg px-2.5 py-0.5 text-[10px] font-bold uppercase text-muted">
              {b.type}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-warning-bg/50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warning">
              <span className="size-1.5 rounded-full bg-warning animate-pulse" />
              Pending Review
            </span>
            <span className="text-xs text-muted">
              Applied {new Date(b.created_at).toLocaleDateString()}
            </span>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 bg-muted-bg/30 p-4 rounded-xl border border-border/50">
            <DetailItem label="Owner">{b.owner_name}</DetailItem>
            <DetailItem label="Owner Email">{b.owner_email}</DetailItem>
            <DetailItem label="Owner Phone">{b.owner_phone}</DetailItem>
            <DetailItem label="WhatsApp">{b.whatsapp_number}</DetailItem>
            <DetailItem label="Opening Hours">{b.opening_hours}</DetailItem>
            <DetailItem label="GST Number">{b.gst_number}</DetailItem>
            <DetailItem label="City">{b.city}</DetailItem>
            <DetailItem label="Address">{[b.address, b.pincode].filter(Boolean).join(", ")}</DetailItem>
          </dl>
          
          {b.tagline && (
            <p className="mt-3 text-xs text-muted italic">
              &ldquo;{b.tagline}&rdquo;
            </p>
          )}
        </div>

        <div className="flex shrink-0 gap-2 items-center self-end md:self-start">
          {!approving && (
            <>
              <button
                disabled={busy}
                onClick={() => setApproving(true)}
                className="rounded-xl bg-success hover:bg-success/90 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-50"
              >
                Approve Request
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  showModal({
                    title: `Reject "${b.name}"`,
                    message: "Please enter the rejection reason below. This will be stored in private admin notes.",
                    type: "prompt",
                    placeholder: "Rejection reason...",
                    okLabel: "Reject Application",
                    isDestructive: true,
                    action: (reason) => {
                      if (reason?.trim()) run(b.id, () => rejectBusiness(b.id, reason));
                    },
                  });
                }}
                className="rounded-xl border border-danger/30 hover:border-danger/60 bg-card hover:bg-danger-bg px-4 py-2.5 text-xs font-bold text-danger transition-all cursor-pointer disabled:opacity-50"
              >
                Reject
              </button>
            </>
          )}
        </div>
      </div>

      {approving && (
        <div className="mt-4 flex flex-wrap items-end gap-4 rounded-xl border border-border bg-muted-bg/50 p-4 animate-fade-in">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Select Plan Tier</label>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value as Plan)}
              className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground outline-none focus:border-primary transition-all"
            >
              <option value="free">Free Tier — 30 menu items</option>
              <option value="basic">Basic Tier — Photos, 100 items</option>
              <option value="premium">Premium Tier — All features, 500 items</option>
            </select>
          </div>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Allocated Tables</label>
            <input
              type="number"
              min={0}
              max={200}
              value={tables}
              onChange={(e) => setTables(e.target.value)}
              className="w-24 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground outline-none focus:border-primary transition-all"
            />
          </div>

          <div className="flex gap-2 ml-auto">
            <button
              disabled={busy}
              onClick={() => {
                run(b.id, () => approveBusiness(b.id, plan, Number(tables)));
                setApproving(false);
              }}
              className="rounded-xl bg-success hover:bg-success/90 px-4 py-2 text-xs font-bold text-white transition-all cursor-pointer disabled:opacity-50"
            >
              Confirm & Activate
            </button>
            <button
              onClick={() => setApproving(false)}
              className="rounded-xl px-3 py-2 text-xs font-bold text-muted hover:text-foreground hover:bg-muted-bg transition-all cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Standard card for Approved, Suspended, or Rejected businesses */
function RegularCard({
  b,
  busy,
  run,
  menuBaseUrl,
  showModal,
}: {
  b: Business;
  busy: boolean;
  run: (id: string, action: () => Promise<ActionResult>) => void;
  menuBaseUrl?: string;
  showModal: (config: {
    title: string;
    message: string;
    type: "confirm" | "prompt";
    placeholder?: string;
    okLabel?: string;
    isDestructive?: boolean;
    action: (inputValue?: string) => void;
  }) => void;
}) {
  const getStatusConfig = () => {
    switch (b.status) {
      case "approved":
        return {
          border: "border-border hover:border-success/30",
          badge: "bg-success-bg/60 text-success",
          dot: "bg-success",
          label: "Active",
        };
      case "suspended":
        return {
          border: "border-danger/30 hover:border-danger/50",
          badge: "bg-danger-bg/50 text-danger",
          dot: "bg-danger",
          label: "Suspended",
        };
      default:
        return {
          border: "border-border/60 hover:border-muted",
          badge: "bg-muted-bg text-muted opacity-80",
          dot: "bg-muted",
          label: "Rejected",
        };
    }
  };

  const style = getStatusConfig();

  return (
    <div className={`rounded-2xl border ${style.border} bg-card p-5 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <Link href={`/business/${b.id}`} className="text-base font-bold text-foreground hover:text-primary transition-colors hover:underline">
            {b.name}
          </Link>
          <span className="rounded-full bg-muted-bg px-2 py-0.5 text-[9px] font-bold uppercase text-muted">
            {b.type}
          </span>
          {b.is_demo && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase text-primary">
              Demo
            </span>
          )}
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style.badge}`}>
            <span className={`size-1.5 rounded-full ${style.dot}`} />
            {style.label}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span>{b.owner_email ?? "No Linked Account"}</span>
          <span>·</span>
          <span>WA: {b.whatsapp_number}</span>
          <span>·</span>
          {menuBaseUrl ? (
            <a
              href={`${menuBaseUrl}/m/${b.slug}`}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline font-medium"
            >
              /m/{b.slug}
            </a>
          ) : (
            <span>/m/{b.slug}</span>
          )}
          {b.city && (
            <>
              <span>·</span>
              <span>{b.city}</span>
            </>
          )}
        </div>

        {b.admin_notes && (
          <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-muted-bg/30 p-2 border border-border/50 max-w-xl">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="size-4 text-muted shrink-0 mt-0.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
              />
            </svg>
            <p className="text-xs text-muted leading-snug">
              <span className="font-bold">Admin note:</span> &ldquo;{b.admin_notes}&rdquo;
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
        {b.status === "approved" && (
          <>
            <span className="rounded-full bg-muted-bg border border-border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
              {b.plan} · {b.table_count} tables
            </span>
            <button
              disabled={busy}
              onClick={() => {
                showModal({
                  title: `Suspend "${b.name}"`,
                  message: "The owner will be locked out and their public menus will go offline. Please specify the reason below:",
                  type: "prompt",
                  placeholder: "Suspension reason...",
                  okLabel: "Suspend Account",
                  isDestructive: true,
                  action: (reason) => {
                    if (reason?.trim()) run(b.id, () => suspendBusiness(b.id, reason));
                  },
                });
              }}
              className="rounded-xl border border-danger/30 hover:border-danger bg-card hover:bg-danger-bg px-4 py-2.5 text-xs font-bold text-danger transition-all cursor-pointer disabled:opacity-50"
            >
              Suspend
            </button>
          </>
        )}

        {b.status === "suspended" && (
          <button
            disabled={busy}
            onClick={() => run(b.id, () => reactivateBusiness(b.id))}
            className="rounded-xl bg-success hover:bg-success/90 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-50"
          >
            Reactivate Account
          </button>
        )}

        {b.status === "rejected" && (
          <button
            disabled={busy}
            onClick={() => {
              showModal({
                title: `Delete "${b.name}" permanently?`,
                message: "This will remove the business registry from the database. The owner will be freed to apply again. This action cannot be undone.",
                type: "confirm",
                okLabel: "Delete Permanently",
                isDestructive: true,
                action: () => {
                  run(b.id, () => deleteRejectedBusiness(b.id));
                },
              });
            }}
            className="rounded-xl border border-border hover:border-danger bg-card hover:bg-danger-bg px-4 py-2.5 text-xs font-bold text-muted hover:text-danger transition-all cursor-pointer disabled:opacity-50"
          >
            Delete Permanently
          </button>
        )}
      </div>
    </div>
  );
}
