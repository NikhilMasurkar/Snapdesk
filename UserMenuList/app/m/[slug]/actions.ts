"use server";

import { getSupabase } from "@/lib/supabase";
import type { Testimonial } from "@/lib/types";
import type { CartLine } from "@/lib/cart";

// ── Orders ───────────────────────────────────────────────────────────────────

export type PlaceOrderInput = {
  businessId: string;
  table: string | null;
  note: string;
  lines: CartLine[];
  /** Client-generated UUID; the DB's unique constraint makes retries idempotent. */
  clientKey: string;
};

export type PlaceOrderResult =
  | { ok: true; shortId: string }
  /** blocked=true means the DB deliberately refused (flood cap / ordering
   *  closed); either way the client shows the error and keeps the cart. */
  | { ok: false; error: string; blocked: boolean };

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const lines = (input.lines ?? []).filter(
    (l) =>
      l &&
      typeof l.itemId === "string" &&
      typeof l.name === "string" &&
      l.name.trim().length > 0 &&
      Number.isInteger(l.qty) &&
      l.qty >= 1 &&
      l.qty <= 99 &&
      Number.isFinite(Number(l.unitPrice)) &&
      Number(l.unitPrice) >= 0
  );
  if (lines.length === 0 || lines.length > 50) {
    return { ok: false, error: "Invalid order.", blocked: true };
  }

  const note = (input.note ?? "").trim().slice(0, 200);
  const table = input.table?.trim() ? input.table.trim().slice(0, 20) : null;
  const items = lines.map((l) => ({
    item_id: l.itemId,
    name: l.name.trim().slice(0, 120),
    portion: l.portion,
    qty: l.qty,
    unit_price: Number(l.unitPrice),
    line_total: Math.round(Number(l.unitPrice) * l.qty * 100) / 100,
  }));
  const total = Math.round(items.reduce((s, i) => s + i.line_total, 0) * 100) / 100;

  const supabase = getSupabase();

  // Placed via the `place_order` RPC (security definer): anon has no SELECT
  // policy on orders, so a direct insert+returning fails the read-back. The
  // RPC re-checks the business gate, dedupes on client_key, and returns the
  // short_id. See BusinessDashboard/supabase/phase3.sql.
  const { data, error } = await supabase.rpc("place_order", {
    p_business_id: input.businessId,
    p_table_no: table,
    p_items: items,
    p_total: total,
    p_note: note || null,
    p_client_key: input.clientKey || null,
  });

  if (!error && typeof data === "string" && data.length > 0) {
    return { ok: true, shortId: data };
  }

  if (error?.code === "P0001") {
    // Our RPC / pending-cap trigger raised a customer-friendly message
    // (ordering closed or too many pending orders).
    return { ok: false, error: error.message, blocked: true };
  }
  // Anything else (network, config): don't block a real order.
  return { ok: false, error: "Could not record the order.", blocked: false };
}

// ── Scan analytics ───────────────────────────────────────────────────────────

/** Fire-and-forget page-load tracking. Never throws; failures are irrelevant. */
export async function trackScan(businessId: string, table: string | null): Promise<void> {
  try {
    const supabase = getSupabase();
    await supabase.from("scan_events").insert({
      business_id: businessId,
      table_no: table?.trim() ? table.trim().slice(0, 20) : null,
    });
  } catch {
    // ignore
  }
}

// ── Reviews ──────────────────────────────────────────────────────────────────

const REVIEWS_PAGE_SIZE = 10;

/** Next batch of approved reviews, newest first. Used by "Show more". */
export async function loadMoreReviews(
  businessId: string,
  offset: number
): Promise<{ ok: true; reviews: Testimonial[] } | { ok: false; error: string }> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("testimonials")
    .select("*")
    .eq("business_id", businessId)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .range(offset, offset + REVIEWS_PAGE_SIZE - 1);

  if (error) return { ok: false, error: "Could not load more reviews." };
  return { ok: true, reviews: (data ?? []) as Testimonial[] };
}

export type ReviewInput = {
  name: string;
  rating: number;
  text: string;
  /** §0.7 which table the reviewer scanned from (QR ?table param). */
  table?: string | null;
};

export type ReviewResult = { ok: true } | { ok: false; error: string };

export async function submitReview(
  businessId: string,
  input: ReviewInput
): Promise<ReviewResult> {
  const name = input.name.trim();
  const text = input.text.trim();
  const rating = Math.round(Number(input.rating));

  if (!name) return { ok: false, error: "Please enter your name." };
  if (name.length > 60)
    return { ok: false, error: "Name must be 60 characters or less." };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5)
    return { ok: false, error: "Please pick a star rating." };
  if (!text) return { ok: false, error: "Please write a short review." };
  if (text.length > 500)
    return { ok: false, error: "Review must be 500 characters or less." };

  const supabase = getSupabase();
  // RLS only permits status='pending' inserts — customers can never
  // self-publish; the owner approves in the Business Dashboard.
  const { error } = await supabase.from("testimonials").insert({
    business_id: businessId,
    customer_name: name,
    rating,
    text,
    status: "pending",
    table_hint: input.table?.trim() ? input.table.trim().slice(0, 20) : null,
  });

  if (error) {
    return { ok: false, error: "Could not submit your review. Please try again." };
  }
  return { ok: true };
}
