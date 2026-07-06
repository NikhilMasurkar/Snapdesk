"use server";

import { getSupabase } from "@/lib/supabase";
import type { Testimonial } from "@/lib/types";
import type { CartLine } from "@/lib/cart";

// ── Orders ───────────────────────────────────────────────────────────────────

// No 0/O/1/I — unambiguous when read over the phone or from a WhatsApp message.
const SHORT_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeShortId(): string {
  let id = "";
  for (let i = 0; i < 4; i++) {
    id += SHORT_ID_ALPHABET[Math.floor(Math.random() * SHORT_ID_ALPHABET.length)];
  }
  return id;
}

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
   *  closed) — show the error instead of proceeding to WhatsApp. */
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

  // Retry a few times on short_id collision (4 chars from a 32-char alphabet
  // → collisions are rare but possible).
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, error } = await supabase
      .from("orders")
      .insert({
        short_id: makeShortId(),
        business_id: input.businessId,
        table_no: table,
        items,
        total,
        note: note || null,
        client_key: input.clientKey || null,
      })
      .select("short_id")
      .single();

    if (!error) return { ok: true, shortId: (data as { short_id: string }).short_id };

    if (error.code === "23505") {
      // Unique violation: either a double-tap (client_key) or a short_id clash.
      if (error.message.includes("client_key")) {
        const { data: existing } = await supabase
          .from("orders")
          .select("short_id")
          .eq("client_key", input.clientKey)
          .maybeSingle();
        if (existing) return { ok: true, shortId: existing.short_id as string };
        return { ok: false, error: "Could not place the order.", blocked: false };
      }
      continue; // short_id collision — try a fresh one
    }

    if (error.code === "P0001") {
      // Our own trigger (pending-order cap) — its message is customer-friendly.
      return { ok: false, error: error.message, blocked: true };
    }
    if (error.code === "42501") {
      // RLS refused: ordering closed / business offline since page load.
      return {
        ok: false,
        error: "This business is not taking orders right now.",
        blocked: true,
      };
    }
    // Anything else (network, config): don't block a real order.
    return { ok: false, error: "Could not record the order.", blocked: false };
  }
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
  });

  if (error) {
    return { ok: false, error: "Could not submit your review. Please try again." };
  }
  return { ok: true };
}
