"use server";

import { revalidatePath } from "next/cache";
import { getAdmin } from "@/lib/admin";
import { writeAudit } from "@/lib/audit";
import { createServiceClient } from "@/lib/service";
import { canSalesManager, canSalesMember } from "@/lib/roles";
import type { LeadTemperature } from "@/lib/types";
import type { ActionResult } from "../actions";

const TEMPS: LeadTemperature[] = ["hot", "warm", "cold", "not_answering"];

/** Shared gate: caller must hold a sales-capable role. */
async function salesCtx() {
  const { user, roles } = await getAdmin();
  if (!canSalesMember(roles)) throw new Error("Not authorized");
  return { user, roles, isManager: canSalesManager(roles) };
}

export type LeadInput = {
  business_name: string;
  contact_name: string;
  phone: string;
  address: string;
  google_maps_url: string;
  source: string;
  assigned_to: string; // "" = unassigned
};

export async function addLead(input: LeadInput): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await salesCtx();
  } catch {
    return { ok: false, error: "Not authorized." };
  }

  const name = input.business_name.trim();
  if (!name) return { ok: false, error: "Business name is required." };
  const phone = input.phone.replace(/\D/g, "");
  if (phone.length < 10 || phone.length > 15) {
    return { ok: false, error: "Phone must be 10–15 digits." };
  }
  const url = input.google_maps_url.trim();
  if (url && !/^https?:\/\//.test(url)) {
    return { ok: false, error: "Google Business link must be a full https:// URL." };
  }

  // members can only assign to themselves; managers to anyone
  const assignedTo = ctx.isManager
    ? input.assigned_to || null
    : ctx.user.id;

  const service = createServiceClient();

  // duplicate check: same last-10-digits already in an open lead
  const last10 = phone.slice(-10);
  const { data: dup } = await service
    .from("leads")
    .select("id, business_name")
    .eq("status", "open")
    .like("phone", `%${last10}`)
    .limit(1)
    .maybeSingle();
  if (dup) {
    return {
      ok: false,
      error: `An open lead already exists with this phone (${(dup as { business_name: string }).business_name}).`,
    };
  }

  const { data, error } = await service
    .from("leads")
    .insert({
      business_name: name,
      contact_name: input.contact_name.trim() || null,
      phone,
      address: input.address.trim() || null,
      google_maps_url: url || null,
      source: input.source.trim() || null,
      assigned_to: assignedTo,
      created_by: ctx.user.id,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await writeAudit(ctx.user.id, "add_lead", "lead", (data as { id: string }).id, {
    business_name: name,
    phone,
    assigned_to: assignedTo,
  });
  revalidatePath("/leads");
  return { ok: true };
}

/** Managers assign/reassign; "" clears the assignment. */
export async function assignLead(leadId: string, userId: string): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await salesCtx();
  } catch {
    return { ok: false, error: "Not authorized." };
  }
  if (!ctx.isManager) return { ok: false, error: "Only a sales manager can assign leads." };

  const service = createServiceClient();
  const { error } = await service
    .from("leads")
    .update({ assigned_to: userId || null })
    .eq("id", leadId);
  if (error) return { ok: false, error: error.message };

  await writeAudit(ctx.user.id, "assign_lead", "lead", leadId, { assigned_to: userId || null });
  revalidatePath("/leads");
  return { ok: true };
}

/** Fetch a lead and verify the caller may act on it (own lead, or manager). */
async function ownedLead(
  service: ReturnType<typeof createServiceClient>,
  ctx: Awaited<ReturnType<typeof salesCtx>>,
  leadId: string
): Promise<string | null> {
  const { data } = await service
    .from("leads")
    .select("assigned_to, status")
    .eq("id", leadId)
    .maybeSingle();
  if (!data) return "Lead not found.";
  const row = data as { assigned_to: string | null; status: string };
  if (row.status !== "open") return "This lead is closed.";
  if (!ctx.isManager && row.assigned_to !== ctx.user.id) {
    return "This lead is not assigned to you.";
  }
  return null;
}

export type CallLogInput = {
  remark: string;
  temperature: LeadTemperature | "";
  callback_at: string; // datetime-local value or ""
};

/** One action per call: remark (required) + optional temperature + callback date. */
export async function logCall(leadId: string, input: CallLogInput): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await salesCtx();
  } catch {
    return { ok: false, error: "Not authorized." };
  }
  const remark = input.remark.trim().slice(0, 1000);
  if (!remark) return { ok: false, error: "A remark is required." };
  if (input.temperature && !TEMPS.includes(input.temperature)) {
    return { ok: false, error: "Invalid temperature." };
  }

  const service = createServiceClient();
  const denied = await ownedLead(service, ctx, leadId);
  if (denied) return { ok: false, error: denied };

  const { error: rErr } = await service
    .from("lead_remarks")
    .insert({ lead_id: leadId, author_id: ctx.user.id, text: remark });
  if (rErr) return { ok: false, error: rErr.message };

  const patch: Record<string, unknown> = {};
  if (input.temperature) patch.temperature = input.temperature;
  patch.callback_at = input.callback_at ? new Date(input.callback_at).toISOString() : null;
  const { error: uErr } = await service.from("leads").update(patch).eq("id", leadId);
  if (uErr) return { ok: false, error: uErr.message };

  await writeAudit(ctx.user.id, "log_lead_call", "lead", leadId, {
    temperature: input.temperature || null,
    callback_at: patch.callback_at,
  });
  revalidatePath("/leads");
  return { ok: true };
}

/** Close a lead as converted or dead. Reason required (stored + remarked). */
export async function closeLead(
  leadId: string,
  status: "converted" | "dead",
  reason: string
): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await salesCtx();
  } catch {
    return { ok: false, error: "Not authorized." };
  }
  const trimmed = reason.trim().slice(0, 500);
  if (!trimmed) return { ok: false, error: "A reason is required to close a lead." };

  const service = createServiceClient();
  const denied = await ownedLead(service, ctx, leadId);
  if (denied) return { ok: false, error: denied };

  const { error } = await service
    .from("leads")
    .update({ status, status_reason: trimmed, callback_at: null })
    .eq("id", leadId);
  if (error) return { ok: false, error: error.message };

  await service
    .from("lead_remarks")
    .insert({ lead_id: leadId, author_id: ctx.user.id, text: `[${status}] ${trimmed}` });

  await writeAudit(ctx.user.id, "close_lead", "lead", leadId, { status, reason: trimmed });
  revalidatePath("/leads");
  return { ok: true };
}

/** Managers can reopen a wrongly-closed lead. */
export async function reopenLead(leadId: string): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await salesCtx();
  } catch {
    return { ok: false, error: "Not authorized." };
  }
  if (!ctx.isManager) return { ok: false, error: "Only a sales manager can reopen leads." };

  const service = createServiceClient();
  const { error } = await service
    .from("leads")
    .update({ status: "open", status_reason: null })
    .eq("id", leadId);
  if (error) return { ok: false, error: error.message };

  await writeAudit(ctx.user.id, "reopen_lead", "lead", leadId, {});
  revalidatePath("/leads");
  return { ok: true };
}
