"use client";

import { useState, useTransition } from "react";
import { submitReview } from "./actions";

export default function ReviewForm({ businessId }: { businessId: string }) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState("");
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (submitted) {
    return (
      <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
        ✅ Thanks for your review! It will appear here once the business
        approves it.
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-4 w-full rounded-xl border border-zinc-200 py-2.5 text-sm font-semibold text-zinc-700 active:bg-zinc-50"
      >
        ✍️ Write a review
      </button>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await submitReview(businessId, { name, rating, text });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSubmitted(true);
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 flex flex-col gap-3 rounded-xl border border-zinc-200 p-3"
    >
      <p className="text-sm font-semibold">Write a review</p>

      <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={rating === star}
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
            onClick={() => setRating(star)}
            className={`text-2xl leading-none transition-colors ${
              star <= rating ? "text-amber-500" : "text-zinc-300"
            }`}
          >
            ★
          </button>
        ))}
      </div>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        maxLength={60}
        required
        className="rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
      />

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="How was your experience?"
        rows={3}
        maxLength={500}
        required
        className="rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || rating === 0}
          className="flex-1 rounded-lg bg-zinc-900 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Submitting…" : "Submit review"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-4 py-2.5 text-sm font-medium text-zinc-500"
        >
          Cancel
        </button>
      </div>
      {rating === 0 && (
        <p className="text-xs text-zinc-400">Tap the stars to rate.</p>
      )}
    </form>
  );
}
