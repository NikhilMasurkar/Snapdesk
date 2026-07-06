"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { writeAudit } from "@/lib/audit";
import { createServiceClient } from "@/lib/service";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * PHASE3_SPEC §4.2 adminAction wrapper: admin check first, mutation via
 * service client, then a mandatory audit row. The service role bypasses RLS,
 * so the requireAdmin() call here IS the security boundary.
 */
async function adminAction(
  action: string,
  targetId: string,
  detail: Record<string, unknown>,
  mutate: (service: ReturnType<typeof createServiceClient>) => Promise<string | null>
): Promise<ActionResult> {
  let adminId: string;
  try {
    adminId = (await requireAdmin()).id;
  } catch {
    return { ok: false, error: "Not authorized." };
  }

  const service = createServiceClient();
  const error = await mutate(service);
  if (error) return { ok: false, error };

  await writeAudit(adminId, action, "business", targetId, detail);
  revalidatePath("/");
  return { ok: true };
}

const PLANS = ["free", "basic", "premium"] as const;
export type Plan = (typeof PLANS)[number];

// Plan presets (spec 4.3): what each plan unlocks.
const PLAN_FEATURES: Record<Plan, Record<string, boolean | number>> = {
  free: { photos_enabled: false, analytics_enabled: false, max_menu_items: 30 },
  basic: { photos_enabled: true, analytics_enabled: false, max_menu_items: 100 },
  premium: { photos_enabled: true, analytics_enabled: true, max_menu_items: 500 },
};

export async function approveBusiness(
  id: string,
  plan: Plan,
  tableCount: number
): Promise<ActionResult> {
  if (!PLANS.includes(plan)) return { ok: false, error: "Invalid plan." };
  const tables = Math.floor(Number(tableCount));
  if (Number.isNaN(tables) || tables < 0 || tables > 200) {
    return { ok: false, error: "Table count must be between 0 and 200." };
  }

  return adminAction("approve_business", id, { plan, table_count: tables }, async (service) => {
    const { error } = await service
      .from("businesses")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        plan,
        table_count: tables,
      })
      .eq("id", id);
    if (error) return error.message;

    const { error: fErr } = await service
      .from("business_features")
      .update(PLAN_FEATURES[plan])
      .eq("business_id", id);
    return fErr?.message ?? null;
  });
}

export async function rejectBusiness(id: string, reason: string): Promise<ActionResult> {
  if (!reason.trim()) return { ok: false, error: "A rejection reason is required." };
  return adminAction("reject_business", id, { reason }, async (service) => {
    const { error } = await service
      .from("businesses")
      .update({ status: "rejected", admin_notes: reason.trim() })
      .eq("id", id);
    return error?.message ?? null;
  });
}

export async function suspendBusiness(id: string, reason: string): Promise<ActionResult> {
  if (!reason.trim()) return { ok: false, error: "A suspension reason is required." };
  return adminAction("suspend_business", id, { reason }, async (service) => {
    const { error } = await service
      .from("businesses")
      .update({ status: "suspended", admin_notes: reason.trim() })
      .eq("id", id);
    return error?.message ?? null;
  });
}

export async function reactivateBusiness(id: string): Promise<ActionResult> {
  return adminAction("reactivate_business", id, {}, async (service) => {
    const { error } = await service
      .from("businesses")
      .update({ status: "approved" })
      .eq("id", id);
    return error?.message ?? null;
  });
}

/** Frees the owner account to re-apply (one-business-per-owner rule). */
export async function deleteRejectedBusiness(id: string): Promise<ActionResult> {
  return adminAction("delete_business", id, {}, async (service) => {
    const { error } = await service
      .from("businesses")
      .delete()
      .eq("id", id)
      .eq("status", "rejected"); // only rejected rows are deletable
    return error?.message ?? null;
  });
}
