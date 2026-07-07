"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOwnerBusiness } from "@/lib/dal";
import { type ActionResult, ok, fail } from "@/lib/action-result";

/**
 * 10.4 Void a bill. The protect_bill_columns trigger enforces the real rules
 * (only false→true with a reason, within 24h, nothing else editable); this
 * action just supplies a valid payload and a friendly error path.
 */
export async function voidBill(
  billId: string,
  reason: string
): Promise<ActionResult> {
  const business = await getOwnerBusiness();
  if (!business) return fail("No business found.");

  const trimmed = reason.trim();
  if (!trimmed) return fail("A reason is required to void a bill.");
  if (trimmed.length > 200) return fail("Reason must be 200 characters or less.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("bills")
    .update({ is_void: true, void_reason: trimmed })
    .eq("id", billId)
    .eq("business_id", business.id);

  if (error) return fail(error.message);
  revalidatePath(`/dashboard/bills/${billId}`);
  revalidatePath("/dashboard/tables", "layout");
  return ok;
}
