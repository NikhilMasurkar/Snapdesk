"use client";

import { useState, useTransition } from "react";
import type { Testimonial } from "@/lib/types";
import { loadMoreReviews } from "./actions";
import ReviewForm from "./ReviewForm";

function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating} out of 5 stars`} className="text-amber-500">
      {"★".repeat(rating)}
      <span className="text-zinc-300">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

type Props = {
  businessId: string;
  slug: string;
  initialReviews: Testimonial[];
  /** True totals across ALL approved reviews (from business_review_stats). */
  totalCount: number;
  avgRating: number;
};

export default function ReviewsSection({
  businessId,
  slug,
  initialReviews,
  totalCount,
  avgRating,
}: Props) {
  const [reviews, setReviews] = useState(initialReviews);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const hasMore = reviews.length < totalCount;

  const showMore = () =>
    startTransition(async () => {
      setError(null);
      const result = await loadMoreReviews(businessId, reviews.length);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Dedupe on id in case a new review was approved between loads
      setReviews((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...result.reviews.filter((r) => !seen.has(r.id))];
      });
    });

  return (
    <section className="border-t border-zinc-100 px-4 pt-6">
      <h2 className="text-base font-semibold">What customers say</h2>

      {totalCount > 0 ? (
        <>
          <p className="mt-1 text-sm text-zinc-600">
            <Stars rating={Math.round(avgRating)} />{" "}
            <span className="font-medium">{avgRating.toFixed(1)}</span> ·{" "}
            {totalCount} review{totalCount > 1 ? "s" : ""}
          </p>
          <div className="mt-3 flex flex-col gap-3">
            {reviews.map((t) => (
              <blockquote
                key={t.id}
                className="rounded-xl border border-zinc-100 bg-zinc-50 p-3"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{t.customer_name}</span>
                  <Stars rating={t.rating} />
                </div>
                <p className="mt-1 text-sm text-zinc-600">{t.text}</p>
              </blockquote>
            ))}
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          {hasMore && (
            <button
              onClick={showMore}
              disabled={pending}
              className="mt-3 w-full rounded-xl border border-zinc-200 py-2.5 text-sm font-semibold text-zinc-700 active:bg-zinc-50 disabled:opacity-50"
            >
              {pending
                ? "Loading…"
                : `Show more reviews (${totalCount - reviews.length})`}
            </button>
          )}
        </>
      ) : (
        <p className="mt-1 text-sm text-zinc-500">
          No reviews yet — be the first!
        </p>
      )}

      <ReviewForm businessId={businessId} slug={slug} />
    </section>
  );
}
