"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/dal";
import { type ActionResult, ok, fail } from "@/lib/action-result";

export async function setTestimonialStatus(
  testimonialId: string,
  status: "approved" | "rejected"
): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("testimonials")
    .update({ status })
    .eq("id", testimonialId);

  if (error) return fail(error.message);
  revalidatePath("/dashboard/testimonials");
  return ok;
}
