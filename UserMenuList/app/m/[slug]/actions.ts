"use server";

import { getSupabase } from "@/lib/supabase";
import type { Testimonial } from "@/lib/types";

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
