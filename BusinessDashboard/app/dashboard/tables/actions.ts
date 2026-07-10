"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOwnerBusiness } from "@/lib/dal";
import { type ActionResult, ok, fail } from "@/lib/action-result";

/**
 * Move a pending customer order to approved or rejected. RLS ("owner update
 * own orders") + the protect_order_columns trigger enforce that only the
 * owner's own orders change and only along legal transitions.
 */
export async function approveOrder(orderId: string): Promise<ActionResult> {
  const business = await getOwnerBusiness();
  if (!business) return fail("No business found.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ status: "approved" })
    .eq("id", orderId)
    .eq("business_id", business.id)
    .eq("status", "pending");

  if (error) return fail(error.message);
  revalidatePath("/dashboard/tables");
  return ok;
}

/** Rejections carry a reason (§0.2) — matters for disputes. */
export async function rejectOrder(
  orderId: string,
  reason: string
): Promise<ActionResult> {
  const business = await getOwnerBusiness();
  if (!business) return fail("No business found.");
  const trimmed = reason.trim().slice(0, 200);
  if (!trimmed) return fail("A reason is required to reject an order.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ status: "rejected", status_reason: trimmed })
    .eq("id", orderId)
    .eq("business_id", business.id)
    .eq("status", "pending");

  if (error) return fail(error.message);
  revalidatePath("/dashboard/tables");
  return ok;
}

/**
 * §0.1 "Clear table (no bill)": cancel every approved unbilled order on the
 * table (customer walked out, wrong table, …). Keeps the records, never
 * counts as revenue. Reason required.
 */
export async function clearTable(
  tableNo: string | null,
  reason: string
): Promise<ActionResult> {
  const business = await getOwnerBusiness();
  if (!business) return fail("No business found.");
  const trimmed = reason.trim().slice(0, 200);
  if (!trimmed) return fail("A reason is required to clear a table.");

  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .update({ status: "cancelled", status_reason: trimmed })
    .eq("business_id", business.id)
    .eq("status", "approved")
    .is("bill_id", null);
  query = tableNo === null ? query.is("table_no", null) : query.eq("table_no", tableNo);

  const { error } = await query;
  if (error) return fail(error.message);
  revalidatePath("/dashboard/tables", "layout");
  return ok;
}

/**
 * 10.1 master switch. accepting_orders is NOT a protected column — owners flip
 * it freely (start/stop taking orders for the night).
 */
export async function setAcceptingOrders(
  accepting: boolean
): Promise<ActionResult> {
  const business = await getOwnerBusiness();
  if (!business) return fail("No business found.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({ accepting_orders: accepting })
    .eq("id", business.id);

  if (error) return fail(error.message);
  revalidatePath("/dashboard/tables");
  revalidatePath("/dashboard/settings");
  return ok;
}
