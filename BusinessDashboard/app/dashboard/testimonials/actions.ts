"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function setTestimonialStatus(
  testimonialId: string,
  status: "approved" | "rejected" | "pending"
) {
  const supabase = await createClient();
  await supabase.from("testimonials").update({ status }).eq("id", testimonialId);
  revalidatePath("/dashboard/testimonials");
}
