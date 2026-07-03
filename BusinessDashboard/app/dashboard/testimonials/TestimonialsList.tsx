"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Check, MessageSquareQuote, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Testimonial } from "@/lib/types";
import { setTestimonialStatus } from "./actions";

const statusVariant: Record<Testimonial["status"], "secondary" | "default" | "destructive"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
};

export default function TestimonialsList({ testimonials }: { testimonials: Testimonial[] }) {
  const [pending, startTransition] = useTransition();

  const setStatus = (t: Testimonial, status: "approved" | "rejected") =>
    startTransition(async () => {
      const result = await setTestimonialStatus(t.id, status);
      if (!result.ok) toast.error(result.error);
      else toast.success(status === "approved" ? "Testimonial approved" : "Testimonial rejected");
    });

  if (testimonials.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <MessageSquareQuote className="size-8 text-muted-foreground" />
          <p className="font-medium">No testimonials yet</p>
          <p className="text-sm text-muted-foreground">
            Customer reviews will appear here for approval.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {testimonials.map((t) => (
        <Card key={t.id}>
          <CardContent className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{t.customer_name}</span>
              <Badge variant={statusVariant[t.status]} className="capitalize">
                {t.status}
              </Badge>
            </div>
            <p aria-label={`${t.rating} out of 5 stars`} className="text-sm text-amber-500">
              {"★".repeat(t.rating)}
              <span className="text-muted-foreground/40">{"★".repeat(5 - t.rating)}</span>
            </p>
            <p className="text-sm text-muted-foreground">{t.text}</p>
            <div className="mt-1 flex gap-2">
              {t.status !== "approved" && (
                <Button size="sm" disabled={pending} onClick={() => setStatus(t, "approved")}>
                  <Check /> Approve
                </Button>
              )}
              {t.status !== "rejected" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setStatus(t, "rejected")}
                  className="text-destructive hover:text-destructive"
                >
                  <X /> Reject
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
