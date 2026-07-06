"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/dal";
import { type ActionResult, ok, fail } from "@/lib/action-result";

export type BusinessInput = {
  name: string;
  tagline: string;
  whatsapp_number: string;
  menu_label: string;
  currency: string;
  logo_url: string;
  // 10.1 owner-editable master switch; is_active is admin-only since Phase 3.
  accepting_orders: boolean;
  opening_hours: string;
};

export async function updateBusiness(
  businessId: string,
  input: BusinessInput
): Promise<ActionResult> {
  if (!input.name.trim()) return fail("Business name is required.");

  const whatsapp = input.whatsapp_number.replace(/\D/g, "");
  if (whatsapp.length < 10 || whatsapp.length > 15) {
    return fail("WhatsApp number must be 10–15 digits with country code, e.g. 919812345678.");
  }

  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({
      name: input.name.trim(),
      tagline: input.tagline.trim() || null,
      whatsapp_number: whatsapp,
      menu_label: input.menu_label.trim() || "Menu",
      currency: input.currency.trim() || "₹",
      logo_url: input.logo_url.trim() || null,
      accepting_orders: input.accepting_orders,
      opening_hours: input.opening_hours.trim() || null,
    })
    .eq("id", businessId);

  if (error) return fail(error.message);
  revalidatePath("/dashboard/settings");
  return ok;
}
