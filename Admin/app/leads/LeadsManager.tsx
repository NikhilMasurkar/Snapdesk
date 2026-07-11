"use client";

import { useMemo, useState, useTransition } from "react";
import type { Lead, LeadTemperature } from "@/lib/types";
import {
  addLead,
  assignLead,
  closeLead,
  logCall,
  reopenLead,
  type LeadInput,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TabKey = "open" | "followup" | "unassigned" | "closed";

const TEMP_STYLES: Record<LeadTemperature, string> = {
  hot: "bg-rose-100 text-rose-700 border-rose-300 font-extrabold shadow-2xs",
  warm: "bg-amber-100 text-amber-800 border-amber-300 font-extrabold shadow-2xs",
  cold: "bg-blue-100 text-[#0077D3] border-blue-300 font-extrabold shadow-2xs",
  not_answering: "bg-slate-100 text-slate-700 border-slate-300 font-extrabold shadow-2xs",
};

const ACTIVE_PILL_STYLES: Record<LeadTemperature, string> = {
  hot: "bg-rose-100 text-rose-800 border-1.2 border-rose-500 font-extrabold shadow-sm scale-[1.02]",
  warm: "bg-amber-100 text-amber-900 border-1.2 border-amber-500 font-extrabold shadow-sm scale-[1.02]",
  cold: "bg-blue-100 text-[#0077D3] border-1.2 border-[#0077D3] font-extrabold shadow-sm scale-[1.02]",
  not_answering: "bg-slate-200 text-slate-800 border-1.2 border-slate-500 font-extrabold shadow-sm scale-[1.02]",
};

const INACTIVE_PILL_STYLES: Record<LeadTemperature, string> = {
  hot: "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 font-bold",
  warm: "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 font-bold",
  cold: "bg-blue-50 text-[#0077D3] border-blue-200 hover:bg-blue-100 font-bold",
  not_answering: "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 font-bold",
};

const TEMP_LABELS: Record<LeadTemperature, string> = {
  hot: "Hot Lead",
  warm: "Warm Lead",
  cold: "Cold Lead",
  not_answering: "Not Answering",
};

const EMPTY_FORM: LeadInput = {
  business_name: "",
  contact_name: "",
  phone: "",
  address: "",
  google_maps_url: "",
  source: "",
  assigned_to: "",
};

const inputCls =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[#0077D3]/40";

/** Formats any string into Title / Sentence Case so it always looks clean & professional */
function toTitleCase(str?: string | null): string {
  if (!str) return "";
  return str
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (word.length === 0) return "";
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

/* Crisp SVG Icons for sharp, high-contrast UI */
function PhoneIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.2}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"
      />
    </svg>
  );
}

function WhatsAppIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M12 2a10 10 0 0 0-8.66 15L2 22l5.19-1.3A10 10 0 1 0 12 2zm0 18a7.95 7.95 0 0 1-4.08-1.12l-.29-.17-3.03.79.81-2.95-.19-.3A7.98 7.98 0 1 1 12 20zm4.39-5.99c-.24-.12-1.42-.7-1.64-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.3.18-.54.06-.24-.12-1.01-.37-1.92-1.18-.71-.63-1.19-1.41-1.33-1.65-.14-.24-.01-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.19-.46-.39-.4-.54-.41-.14-.01-.3-.01-.46-.01-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2 0 1.18.86 2.32.98 2.48.12.16 1.7 2.59 4.12 3.63.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.42-.58 1.62-1.14.2-.56.2-.1.04-.14-.24-.12-.4-.18-.64-.3z" />
    </svg>
  );
}

function MapPinIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.2}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
      />
    </svg>
  );
}

function UserIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.2}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
      />
    </svg>
  );
}

export default function LeadsManager({
  leads,
  salesTeam,
  isManager,
}: {
  leads: Lead[];
  salesTeam: { userId: string; email: string }[];
  isManager: boolean;
}) {
  const [tab, setTab] = useState<TabKey>("open");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<LeadInput>(EMPTY_FORM);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const now = Date.now();
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const dueToday = (l: Lead) =>
    l.status === "open" &&
    !!l.callback_at &&
    Date.parse(l.callback_at) <= endOfToday.getTime();

  const counts = useMemo(() => {
    const open = leads.filter((l) => l.status === "open");
    return {
      open: open.length,
      followup: open.filter((l) => l.callback_at).length,
      dueToday: open.filter(dueToday).length,
      unassigned: open.filter((l) => !l.assigned_to).length,
      closed: leads.length - open.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads]);

  // Sales workflow: if callbacks are due, land on the Follow Up tab.
  const [autoTabbed, setAutoTabbed] = useState(false);
  if (!autoTabbed && counts.dueToday > 0) {
    setAutoTabbed(true);
    setTab("followup");
  }

  const visible = leads
    .filter((l) => {
      if (tab === "open") return l.status === "open";
      if (tab === "followup") return l.status === "open" && l.callback_at;
      if (tab === "unassigned") return l.status === "open" && !l.assigned_to;
      return l.status !== "open";
    })
    .sort((a, b) => {
      // Follow Up: earliest callback first (overdue on top).
      if (tab === "followup")
        return Date.parse(a.callback_at ?? "") - Date.parse(b.callback_at ?? "");
      return Date.parse(b.created_at) - Date.parse(a.created_at);
    });

  const selectedLead = useMemo(
    () => leads.find((l) => l.id === selectedLeadId) ?? null,
    [leads, selectedLeadId]
  );

  const run = (fn: () => Promise<{ ok: boolean } & { error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong.");
    });
  };

  const submitAdd = () =>
    run(async () => {
      const formattedInput: LeadInput = {
        ...form,
        business_name: toTitleCase(form.business_name),
        contact_name: toTitleCase(form.contact_name),
        address: toTitleCase(form.address),
        source: form.source ? toTitleCase(form.source) : "",
      };
      const res = await addLead(formattedInput);
      if (res.ok) {
        setForm(EMPTY_FORM);
        setShowAdd(false);
      }
      return res;
    });

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "open", label: "Open", count: counts.open },
    { key: "followup", label: "Follow Up", count: counts.followup },
    { key: "unassigned", label: "Unassigned", count: counts.unassigned },
    { key: "closed", label: "Closed", count: counts.closed },
  ];

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Tabs + Add bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((t) => (
            <Button variant="ghost"
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`h-auto rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                tab === t.key
                  ? "bg-[#0077D3] text-white shadow-md shadow-[#0077D3]/25"
                  : "bg-muted-bg text-muted hover:text-foreground hover:bg-muted-bg/80"
              }`}
            >
              {t.label}{" "}
              <span className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] opacity-85">
                ({t.count})
              </span>
              {t.key === "followup" && counts.dueToday > 0 && (
                <span className="ml-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                  {counts.dueToday} due
                </span>
              )}
            </Button>
          ))}
        </div>

        <Button variant="ghost"
          onClick={() => setShowAdd(!showAdd)}
          className="h-auto inline-flex items-center gap-1.5 rounded-xl bg-[#0077D3] hover:bg-[#0060AA] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all cursor-pointer"
        >
          {showAdd ? (
            "✕ Cancel"
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
                className="size-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
              <span>Add Lead</span>
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="h-auto rounded-xl bg-danger-bg border border-danger/20 px-4 py-3 text-sm text-danger font-medium">
          {error}
        </div>
      )}

      {/* Add lead form */}
      {showAdd && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#0077D3]">
              New Internal Lead
            </h2>
            <span className="text-[11px] text-muted font-medium">
              Fields will be formatted in clean Title Case automatically
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-[11px] font-semibold text-muted mb-1">
                Business Name *
              </label>
              <Input
                className={inputCls}
                placeholder="e.g. Twickle Restro"
                value={form.business_name}
                onChange={(e) =>
                  setForm({ ...form, business_name: e.target.value })
                }
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted mb-1">
                Contact Person
              </label>
              <Input
                className={inputCls}
                placeholder="e.g. Owner / Rohit"
                value={form.contact_name}
                onChange={(e) =>
                  setForm({ ...form, contact_name: e.target.value })
                }
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted mb-1">
                Mobile Number *
              </label>
              <Input
                className={inputCls}
                placeholder="10 digit mobile number"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted mb-1">
                Lead Source
              </label>
              <Input
                className={inputCls}
                placeholder="Walk-in, Referral, Google Maps…"
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-muted mb-1">
                Location / Address
              </label>
              <Input
                className={inputCls}
                placeholder="Complete street or locality address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-muted mb-1">
                Google Business / Maps Link
              </label>
              <Input
                className={inputCls}
                placeholder="https://maps.google.com/..."
                value={form.google_maps_url}
                onChange={(e) =>
                  setForm({ ...form, google_maps_url: e.target.value })
                }
              />
            </div>

            {isManager && (
              <div>
                <label className="block text-[11px] font-semibold text-muted mb-1">
                  Assign To Sales Executive
                </label>
                <Select
                  value={form.assigned_to || "unassigned"}
                  onValueChange={(v) =>
                    setForm({ ...form, assigned_to: !v || v === "unassigned" ? "" : v })
                  }
                >
                  <SelectTrigger className={inputCls}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {salesTeam.map((m) => (
                      <SelectItem key={m.userId} value={m.userId}>
                        {m.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="mt-5 flex items-center justify-end gap-3">
            <Button variant="ghost"
              onClick={() => setShowAdd(false)}
              className="h-auto rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted hover:text-foreground cursor-pointer"
            >
              Cancel
            </Button>
            <Button variant="ghost"
              onClick={submitAdd}
              disabled={pending}
              className="h-auto rounded-xl bg-[#0077D3] hover:bg-[#0060AA] px-5 py-2 text-xs font-bold text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save Lead"}
            </Button>
          </div>
        </div>
      )}

      {/* Full Screen Professional Table */}
      <div className="rounded-2xl border border-border/70 bg-card shadow-xs overflow-hidden">
        {visible.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-xs font-medium text-muted">
              No leads found in this view.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/60 bg-muted-bg/50 text-[11px] font-bold uppercase tracking-wider text-muted">
                  <th className="py-3.5 pl-5 pr-3">Business & Contact</th>
                  <th className="py-3.5 px-3">Phone & Links</th>
                  <th className="py-3.5 px-3">Location</th>
                  <th className="py-3.5 px-3">Assigned To</th>
                  <th className="py-3.5 px-3">Priority / Status</th>
                  <th className="py-3.5 px-3">Follow-up</th>
                  <th className="py-3.5 px-3">Latest Remark</th>
                  <th className="py-3.5 pl-3 pr-5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-xs">
                {visible.map((lead) => (
                  <LeadTableRow
                    key={lead.id}
                    lead={lead}
                    salesTeam={salesTeam}
                    isManager={isManager}
                    onOpenDetails={() => setSelectedLeadId(lead.id)}
                    overdue={
                      !!lead.callback_at &&
                      lead.status === "open" &&
                      Date.parse(lead.callback_at) < now
                    }
                    run={run}
                    pending={pending}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* LEAD DETAILS & COMMENTS MODAL (Executive Console) */}
      {selectedLead && (
        <LeadDetailsModal
          lead={selectedLead}
          salesTeam={salesTeam}
          isManager={isManager}
          onClose={() => setSelectedLeadId(null)}
          run={run}
          pending={pending}
        />
      )}
    </div>
  );
}

function LeadTableRow({
  lead,
  salesTeam,
  isManager,
  onOpenDetails,
  overdue,
  run,
  pending,
}: {
  lead: Lead;
  salesTeam: { userId: string; email: string }[];
  isManager: boolean;
  onOpenDetails: () => void;
  overdue: boolean;
  run: (fn: () => Promise<{ ok: boolean } & { error?: string }>) => void;
  pending: boolean;
}) {
  const formattedBusiness = toTitleCase(lead.business_name);
  const formattedContact = toTitleCase(lead.contact_name);
  const formattedAddress = toTitleCase(lead.address);
  const latestRemark = lead.remarks?.[0]?.text;

  return (
    <tr className="transition-colors hover:bg-muted-bg/30">
      {/* Business & Contact */}
      <td className="py-4 pl-5 pr-3 align-top">
        <Button variant="ghost"
          onClick={onOpenDetails}
          className="font-bold text-sm text-foreground hover:text-[#0077D3] transition-colors text-left cursor-pointer"
        >
          {formattedBusiness || lead.business_name}
        </Button>
        {formattedContact && (
          <div className="flex items-center gap-1 text-[11px] text-muted font-medium mt-0.5">
            <UserIcon className="size-3 text-muted" />
            <span>{formattedContact}</span>
          </div>
        )}
        {lead.source && (
          <span className="inline-block mt-1.5 rounded bg-[#0077D3]/10 text-[#0077D3] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
            {toTitleCase(lead.source)}
          </span>
        )}
      </td>

      {/* Phone & Links */}
      <td className="py-4 px-3 align-top whitespace-nowrap">
        <div className="font-mono font-bold text-foreground">
          +{lead.phone}
        </div>
        <div className="flex items-center gap-1.5 mt-1.5">
          <a
            href={`tel:+${lead.phone}`}
            title="Call Lead"
            className="h-auto inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-bold text-foreground hover:bg-muted-bg hover:border-[#0077D3]/40 transition-colors"
          >
            <PhoneIcon className="size-3.5 text-[#0077D3]" />
            <span>Call</span>
          </a>
          <a
            href={`https://wa.me/${lead.phone}`}
            target="_blank"
            rel="noreferrer"
            title="Open WhatsApp"
            className="h-auto inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-bold text-foreground hover:bg-muted-bg hover:border-emerald-500/40 transition-colors"
          >
            <WhatsAppIcon className="size-3.5 text-emerald-600" />
            <span>WA</span>
          </a>
          {lead.google_maps_url && (
            <a
              href={lead.google_maps_url}
              target="_blank"
              rel="noreferrer"
              title="View Google Maps"
              className="h-auto inline-flex items-center gap-1 rounded-lg border border-[#0077D3]/30 bg-[#0077D3]/10 hover:bg-[#0077D3]/20 px-2 py-1 text-[11px] font-bold text-[#0077D3] transition-colors"
            >
              <MapPinIcon className="size-3.5 text-[#0077D3]" />
              <span>Maps</span>
            </a>
          )}
        </div>
      </td>

      {/* Location */}
      <td className="py-4 px-3 align-top max-w-[200px]">
        <div
          className="text-xs text-muted truncate leading-relaxed"
          title={formattedAddress || lead.address || ""}
        >
          {formattedAddress || "—"}
        </div>
      </td>

      {/* Assigned To */}
      <td className="py-4 px-3 align-top whitespace-nowrap">
        {isManager && lead.status === "open" ? (
          <div className="h-auto inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground shadow-2xs">
            <UserIcon className="size-3.5 text-[#0077D3] shrink-0" />
            <Select
              value={lead.assigned_to ?? "unassigned"}
              onValueChange={(v) => run(() => assignLead(lead.id, !v || v === "unassigned" ? "" : v))}
              disabled={pending}
            >
              <SelectTrigger className="h-auto border-0 bg-transparent p-0 pr-1 text-xs font-semibold shadow-none focus-visible:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {salesTeam.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="h-auto inline-flex items-center gap-1.5 rounded-lg bg-muted-bg/60 px-2.5 py-1 text-xs font-semibold text-muted">
            <UserIcon className="size-3.5 text-muted shrink-0" />
            <span className="truncate max-w-[180px]">
              {lead.assigned_email ?? "Unassigned"}
            </span>
          </div>
        )}
      </td>

      {/* Priority / Temp */}
      <td className="py-4 px-3 align-top whitespace-nowrap">
        {lead.temperature ? (
          <span
            className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
              TEMP_STYLES[lead.temperature]
            }`}
          >
            {TEMP_LABELS[lead.temperature]}
          </span>
        ) : (
          <span className="text-muted text-xs">—</span>
        )}
        {lead.status !== "open" && (
          <div className="mt-1">
            <span
              className={`inline-flex items-center rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                lead.status === "converted"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-muted-bg text-muted border-border/80"
              }`}
            >
              {lead.status}
            </span>
          </div>
        )}
      </td>

      {/* Follow-up */}
      <td
        className="py-4 px-3 align-top whitespace-nowrap"
        suppressHydrationWarning
      >
        {lead.callback_at ? (
          <div
            className={`text-xs font-medium ${
              overdue
                ? "text-rose-600 font-bold bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 inline-block"
                : "text-muted"
            }`}
          >
            ↩{" "}
            {new Intl.DateTimeFormat("en-GB", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(lead.callback_at))}
            {overdue && (
              <span className="block text-[9px] uppercase font-extrabold mt-0.5">
                Overdue
              </span>
            )}
          </div>
        ) : (
          <span className="text-muted text-xs">—</span>
        )}
      </td>

      {/* Latest Remark */}
      <td className="py-4 px-3 align-top max-w-[240px]">
        {latestRemark ? (
          <div
            className="h-auto rounded-xl bg-muted-bg/50 border border-border/60 px-3 py-1.5 text-xs text-foreground font-medium truncate"
            title={latestRemark}
          >
            “{latestRemark}”
          </div>
        ) : (
          <span className="text-muted text-xs italic">No remarks</span>
        )}
      </td>

      {/* Actions */}
      <td className="py-4 pl-3 pr-5 align-top text-right whitespace-nowrap">
        <Button variant="ghost"
          onClick={onOpenDetails}
          className="h-auto inline-flex items-center gap-1.5 rounded-xl bg-[#0077D3] hover:bg-[#005FA8] text-white px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer shadow-sm"
        >
          <span>View Details & Comments</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
            className="size-3.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
            />
          </svg>
        </Button>
      </td>
    </tr>
  );
}

/** Executive Full-Screen / Modal Console inspired by IndigoLearn User Details & Comments interface */
function LeadDetailsModal({
  lead,
  salesTeam,
  isManager,
  onClose,
  run,
  pending,
}: {
  lead: Lead;
  salesTeam: { userId: string; email: string }[];
  isManager: boolean;
  onClose: () => void;
  run: (fn: () => Promise<{ ok: boolean } & { error?: string }>) => void;
  pending: boolean;
}) {
  const [remark, setRemark] = useState("");
  const [temp, setTemp] = useState<LeadTemperature | "">(
    lead.temperature || ""
  );
  const [callback, setCallback] = useState("");
  const [closeReason, setCloseReason] = useState("");
  const [closing, setClosing] = useState<"converted" | "dead" | null>(null);

  const submitCall = () =>
    run(async () => {
      const res = await logCall(lead.id, {
        remark,
        temperature: temp,
        callback_at: callback,
      });
      if (res.ok) {
        setRemark("");
        setCallback("");
      }
      return res;
    });

  const formattedBusiness = toTitleCase(lead.business_name);
  const formattedContact = toTitleCase(lead.contact_name);
  const formattedAddress = toTitleCase(lead.address);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 sm:p-6 animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-5xl rounded-3xl border border-border bg-card shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border/80 px-6 py-4 bg-muted-bg/40">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-foreground">
                Lead Profile & Activity Details
              </h3>
              {lead.status !== "open" && (
                <span className="rounded bg-muted-bg border px-2 py-0.5 text-[10px] font-bold uppercase">
                  {lead.status}
                </span>
              )}
            </div>
            <p className="text-xs text-muted mt-0.5">
              Comprehensive overview, assignment, and chronological comment history
            </p>
          </div>
          <Button variant="ghost"
            onClick={onClose}
            className="rounded-full p-2 text-muted hover:bg-muted-bg hover:text-foreground transition-colors cursor-pointer"
            title="Close modal"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="size-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18 18 6M6 6l12 12"
              />
            </svg>
          </Button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
          {/* Top User Details Summary Card */}
          <div className="rounded-2xl border border-border/70 bg-muted-bg/30 p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">
                  Business Name
                </span>
                <span className="font-extrabold text-sm text-foreground mt-0.5 block">
                  {formattedBusiness || lead.business_name}
                </span>
              </div>

              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">
                  Contact Person
                </span>
                <span className="font-bold text-foreground mt-0.5 block">
                  {formattedContact || "—"}
                </span>
              </div>

              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">
                  Mobile Number
                </span>
                <span className="font-mono font-bold text-foreground mt-0.5 block">
                  +{lead.phone}
                </span>
              </div>

              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">
                  Assigned Executive
                </span>
                <span className="font-semibold text-foreground mt-0.5 block">
                  {lead.assigned_email ?? "Unassigned"}
                </span>
              </div>

              <div className="sm:col-span-2">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">
                  Location / Address
                </span>
                <span className="text-foreground mt-0.5 block">
                  {formattedAddress || "No address provided"}
                </span>
              </div>

              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">
                  Lead Source
                </span>
                <span className="text-foreground mt-0.5 block">
                  {toTitleCase(lead.source) || "Direct / Walk-in"}
                </span>
              </div>

              <div suppressHydrationWarning>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">
                  Created On
                </span>
                <span className="text-foreground mt-0.5 block">
                  {lead.created_at
                    ? new Intl.DateTimeFormat("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      }).format(new Date(lead.created_at))
                    : "—"}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-border/60 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <a
                  href={`tel:+${lead.phone}`}
                  className="h-auto inline-flex items-center gap-1.5 rounded-xl bg-[#0077D3] hover:bg-[#005FA8] text-white px-4 py-2 text-xs font-bold transition-all shadow-sm"
                >
                  <PhoneIcon className="size-4 text-white" />
                  <span>Call Lead</span>
                </a>
                <a
                  href={`https://wa.me/${lead.phone}`}
                  target="_blank"
                  rel="noreferrer"
                  className="h-auto inline-flex items-center gap-1.5 rounded-xl border border-emerald-600/30 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-4 py-2 text-xs font-bold transition-all shadow-sm"
                >
                  <WhatsAppIcon className="size-4 text-emerald-600" />
                  <span>WhatsApp Message</span>
                </a>
                {lead.google_maps_url && (
                  <a
                    href={lead.google_maps_url}
                    target="_blank"
                    rel="noreferrer"
                    className="h-auto inline-flex items-center gap-1.5 rounded-xl border border-[#0077D3]/30 bg-[#0077D3]/10 hover:bg-[#0077D3]/20 text-[#0077D3] px-4 py-2 text-xs font-bold transition-all"
                  >
                    <MapPinIcon className="size-4 text-[#0077D3]" />
                    <span>Open Maps</span>
                  </a>
                )}
              </div>

              {isManager && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-muted">
                    Reassign:
                  </span>
                  <Select
                    value={lead.assigned_to ?? "unassigned"}
                    onValueChange={(v) =>
                      run(() => assignLead(lead.id, !v || v === "unassigned" ? "" : v))
                    }
                    disabled={pending}
                  >
                    <SelectTrigger className="h-auto rounded-xl bg-background text-xs font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {salesTeam.map((m) => (
                        <SelectItem key={m.userId} value={m.userId}>
                          {m.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* Update Lead & Log Call Section */}
          {lead.status === "open" && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#0077D3] mb-3">
                Update Lead & Add Interaction Comment
              </h4>

              <div className="flex flex-col gap-4">
                <Textarea
                  className={inputCls}
                  rows={3}
                  placeholder="Type your interaction comment / notes here (e.g. Said will enroll for classes next week)... *"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                />

                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-muted mr-1">
                      Lead Type:
                    </span>
                    {(Object.keys(TEMP_LABELS) as LeadTemperature[]).map(
                      (tKey) => (
                        <Button variant="ghost"
                          key={tKey}
                          type="button"
                          onClick={() => setTemp(temp === tKey ? "" : tKey)}
                          className={`h-auto rounded-xl border px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                            temp === tKey
                              ? ACTIVE_PILL_STYLES[tKey]
                              : INACTIVE_PILL_STYLES[tKey]
                          }`}
                        >
                          {temp === tKey && (
                            <span className="mr-1 font-black">✓</span>
                          )}
                          {TEMP_LABELS[tKey]}
                        </Button>
                      )
                    )}

                    <span className="text-xs font-semibold text-muted ml-2 mr-1">
                      Follow-up Reminder:
                    </span>
                    <Input
                      type="datetime-local"
                      className="h-auto rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground"
                      value={callback}
                      onChange={(e) => setCallback(e.target.value)}
                    />
                  </div>

                  <Button variant="ghost"
                    type="button"
                    onClick={submitCall}
                    disabled={pending || !remark.trim()}
                    className={`h-auto inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-xs font-extrabold transition-all shadow-sm ${
                      remark.trim() && !pending
                        ? "bg-[#0077D3] hover:bg-[#005FA8] text-white shadow-md cursor-pointer"
                        : "bg-muted-bg text-muted border border-border/80 cursor-not-allowed"
                    }`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2.5}
                      stroke="currentColor"
                      className={`size-4 ${
                        remark.trim() && !pending ? "text-white" : "text-muted"
                      }`}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 4.5v15m7.5-7.5h-15"
                      />
                    </svg>
                    <span>Add Comment & Update</span>
                  </Button>
                </div>

                {/* Outcome actions */}
                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border/60">
                  {closing ? (
                    <>
                      <Input
                        className={`${inputCls} flex-1`}
                        placeholder={`Reason to mark as ${closing} *`}
                        value={closeReason}
                        onChange={(e) => setCloseReason(e.target.value)}
                      />
                      <Button variant="ghost"
                        type="button"
                        onClick={() =>
                          run(async () => {
                            const res = await closeLead(
                              lead.id,
                              closing,
                              closeReason
                            );
                            if (res.ok) {
                              setClosing(null);
                              setCloseReason("");
                            }
                            return res;
                          })
                        }
                        disabled={pending || !closeReason.trim()}
                        className="h-auto rounded-xl bg-[#0077D3] px-4 py-1.5 text-xs font-extrabold text-white cursor-pointer disabled:opacity-50"
                      >
                        Confirm Status Change
                      </Button>
                      <Button variant="ghost"
                        type="button"
                        onClick={() => setClosing(null)}
                        className="h-auto rounded-xl border border-border px-4 py-1.5 text-xs font-bold text-muted cursor-pointer"
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-semibold text-muted mr-1">
                        Close Lead Outcome:
                      </span>
                      <Button variant="ghost"
                        type="button"
                        onClick={() => setClosing("converted")}
                        className="h-auto rounded-xl bg-emerald-100 hover:bg-emerald-200 border border-emerald-400 px-4 py-1.5 text-xs font-extrabold text-emerald-800 cursor-pointer transition-colors shadow-2xs"
                      >
                        ✓ Mark Converted
                      </Button>
                      <Button variant="ghost"
                        type="button"
                        onClick={() => setClosing("dead")}
                        className="h-auto rounded-xl bg-rose-100 hover:bg-rose-200 border border-rose-400 px-4 py-1.5 text-xs font-extrabold text-rose-800 cursor-pointer transition-colors shadow-2xs"
                      >
                        ✕ Mark Dead Lead
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {lead.status !== "open" && (
            <div className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between">
              <span className="text-xs text-muted">
                Lead Closed as{" "}
                <b className="text-foreground uppercase">{lead.status}</b>
                {lead.status_reason && <> — “{lead.status_reason}”</>}
              </span>
              {isManager && (
                <Button variant="ghost"
                  onClick={() => run(() => reopenLead(lead.id))}
                  disabled={pending}
                  className="h-auto rounded-xl border border-border px-4 py-1.5 text-xs font-bold text-foreground hover:bg-muted-bg cursor-pointer"
                >
                  Reopen Lead
                </Button>
              )}
            </div>
          )}

          {/* Dedicated Comments & Interaction History Table */}
          <div className="rounded-2xl border border-border/70 bg-card overflow-hidden">
            <div className="border-b border-border/70 px-5 py-3.5 bg-muted-bg/30 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Comments & Activity Log ({lead.remarks?.length ?? 0})
              </h4>
            </div>

            {(lead.remarks?.length ?? 0) === 0 ? (
              <div className="py-12 text-center text-xs text-muted">
                No interaction comments logged for this lead yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted-bg/40 text-[10px] font-bold uppercase tracking-wider text-muted">
                      <th className="py-3 pl-5 pr-3 w-12">#</th>
                      <th className="py-3 px-3">Date</th>
                      <th className="py-3 px-3">Comments / Interaction Note</th>
                      <th className="py-3 px-3">Commented By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {lead.remarks!.map((r, idx) => (
                      <tr
                        key={r.id}
                        className="hover:bg-muted-bg/30 transition-colors"
                      >
                        <td className="py-3.5 pl-5 pr-3 font-mono font-semibold text-muted">
                          {lead.remarks!.length - idx}
                        </td>
                        <td
                          className="py-3.5 px-3 font-mono text-muted whitespace-nowrap"
                          suppressHydrationWarning
                        >
                          {r.created_at
                            ? new Intl.DateTimeFormat("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              }).format(new Date(r.created_at))
                            : "—"}
                        </td>
                        <td className="py-3.5 px-3 font-medium text-foreground">
                          “{r.text}”
                        </td>
                        <td className="py-3.5 px-3 font-semibold text-muted whitespace-nowrap">
                          {r.author_email ?? "System Admin"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
