import { getOwnerBusiness } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import type { Testimonial } from "@/lib/types";
import TestimonialsList from "./TestimonialsList";

export default async function TestimonialsPage() {
  const business = await getOwnerBusiness();
  if (!business) return null; // layout already handles this case

  const supabase = await createClient();
  const { data } = await supabase
    .from("testimonials")
    .select("*")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Testimonials</h1>
        <p className="text-sm text-muted-foreground">
          Only approved testimonials appear on your public menu.
        </p>
      </div>
      <TestimonialsList testimonials={(data ?? []) as Testimonial[]} />
    </div>
  );
}
