import { getOwnerBusiness } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import type { Testimonial } from "@/lib/types";
import TestimonialsList from "./TestimonialsList";

export default async function TestimonialsPage() {
  const business = await getOwnerBusiness();
  if (!business) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("testimonials")
    .select("*")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-xl font-bold">Testimonials</h1>
      <TestimonialsList testimonials={(data ?? []) as Testimonial[]} />
    </div>
  );
}
