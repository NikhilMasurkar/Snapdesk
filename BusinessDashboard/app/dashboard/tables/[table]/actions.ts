"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOwnerBusiness } from "@/lib/dal";
import { type ActionResult, ok, fail } from "@/lib/action-result";
import type { OrderItemLine } from "@/lib/types";

// No 0/O/1/I — unambiguous short IDs, matching the customer order flow.
const SHORT_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function makeShortId(): string {
  let id = "";
  for (let i = 0; i < 4; i++) {
    id += SHORT_ID_ALPHABET[Math.floor(Math.random() * SHORT_ID_ALPHABET.length)];
  }
  return id;
}

/** Recompute line totals + order total from trusted server-side math. */
function normalize(items: OrderItemLine[]): { items: OrderItemLine[]; total: number } {
  const clean = items
    .filter((l) => l && l.name && Number.isFinite(Number(l.unit_price)) && l.qty > 0)
    .map((l) => ({
      item_id: l.item_id,
      name: String(l.name).slice(0, 120),
      portion: l.portion ?? null,
      qty: Math.min(99, Math.max(1, Math.round(l.qty))),
      unit_price: Number(l.unit_price),
      line_total: Math.round(Number(l.unit_price) * Math.round(l.qty) * 100) / 100,
    }));
  const total = Math.round(clean.reduce((s, l) => s + l.line_total, 0) * 100) / 100;
  return { items: clean, total };
}

/**
 * Overwrite the item lines of one approved, unbilled order. RLS + the
 * protect_order_columns trigger allow editing items/total on an approved
 * order while freezing identity fields and blocking billed/rejected rows.
 */
export async function editOrderItems(
  orderId: string,
  items: OrderItemLine[]
): Promise<ActionResult> {
  const business = await getOwnerBusiness();
  if (!business) return fail("No business found.");

  const { items: clean, total } = normalize(items);
  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ items: clean, total })
    .eq("id", orderId)
    .eq("business_id", business.id)
    .eq("status", "approved");

  if (error) return fail(error.message);
  revalidatePath("/dashboard/tables", "layout");
  return ok;
}

/**
 * Staff adds an item the customer ordered verbally → a new approved,
 * source='staff' order (RLS "owner create staff order"). Owners can read
 * their own orders, so the returning read-back succeeds here (unlike anon).
 */
export async function addStaffItem(
  tableNo: string | null,
  item: OrderItemLine
): Promise<ActionResult> {
  const business = await getOwnerBusiness();
  if (!business) return fail("No business found.");

  const { items: clean, total } = normalize([{ ...item, qty: item.qty || 1 }]);
  if (clean.length === 0) return fail("Invalid item.");

  const supabase = await createClient();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await supabase.from("orders").insert({
      short_id: makeShortId(),
      business_id: business.id,
      table_no: tableNo,
      items: clean,
      total,
      status: "approved",
      source: "staff",
    });
    if (!error) {
      revalidatePath("/dashboard/tables", "layout");
      return ok;
    }
    if (error.code === "23505") continue; // short_id collision — retry
    return fail(error.message);
  }
  return fail("Could not add the item. Please try again.");
}

/**
 * Atomic billing via the create_bill RPC (merges approved unbilled orders for
 * the table, inserts one bill, marks orders billed). Returns the new bill id.
 */
export async function generateBill(
  tableNo: string | null
): Promise<{ ok: true; billId: string } | { ok: false; error: string }> {
  const business = await getOwnerBusiness();
  if (!business) return { ok: false, error: "No business found." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_bill", {
    p_business_id: business.id,
    p_table_no: tableNo,
  });

  if (error) return { ok: false, error: error.message };
  const bill = data as { id: string } | null;
  if (!bill?.id) return { ok: false, error: "Could not generate the bill." };

  revalidatePath("/dashboard/tables", "layout");
  return { ok: true, billId: bill.id };
}
