"use client";

import { useTransition } from "react";
import type { Testimonial } from "@/lib/types";
import { setTestimonialStatus } from "./actions";

const statusStyle: Record<Testimonial["status"], string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
};

export default function TestimonialsList({ testimonials }: { testimonials: Testimonial[] }) {
  const [pending, startTransition] = useTransition();

  if (testimonials.length === 0) {
    return <p className="text-sm text-zinc-500">No testimonials yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {testimonials.map((t) => (
        <div key={t.id} className="rounded-xl border border-zinc-200 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{t.customer_name}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle[t.status]}`}>
              {t.status}
            </span>
          </div>
          <p className="mt-1 text-amber-500">{"★".repeat(t.rating)}<span className="text-zinc-300">{"★".repeat(5 - t.rating)}</span></p>
          <p className="mt-1 text-sm text-zinc-600">{t.text}</p>
          <div className="mt-2 flex gap-2">
            {t.status !== "approved" && (
              <button
                disabled={pending}
                onClick={() => startTransition(() => setTestimonialStatus(t.id, "approved"))}
                className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
              >
                Approve
              </button>
            )}
            {t.status !== "rejected" && (
              <button
                disabled={pending}
                onClick={() => startTransition(() => setTestimonialStatus(t.id, "rejected"))}
                className="rounded bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 disabled:opacity-50"
              >
                Reject
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
