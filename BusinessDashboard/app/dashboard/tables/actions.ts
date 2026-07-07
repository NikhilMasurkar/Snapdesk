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
async function setOrderStatus(
  orderId: string,
  status: "approved" | "rejected"
): Promise<ActionResult> {
  const business = await getOwnerBusiness();
  if (!business) return fail("No business found.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", orderId)
    .eq("business_id", business.id)
    .eq("status", "pending"); // only pending orders can be approved/rejected

  if (error) return fail(error.message);
  revalidatePath("/dashboard/tables");
  return ok;
}

export async function approveOrder(orderId: string): Promise<ActionResult> {
  return setOrderStatus(orderId, "approved");
}

export async function rejectOrder(orderId: string): Promise<ActionResult> {
  return setOrderStatus(orderId, "rejected");
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
