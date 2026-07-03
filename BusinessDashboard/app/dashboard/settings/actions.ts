"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateBusiness(businessId: string, formData: FormData) {
  const supabase = await createClient();

  await supabase
    .from("businesses")
    .update({
      name: String(formData.get("name") ?? "").trim(),
      tagline: String(formData.get("tagline") ?? "").trim() || null,
      whatsapp_number: String(formData.get("whatsapp_number") ?? "").replace(/\D/g, ""),
      menu_label: String(formData.get("menu_label") ?? "Menu").trim() || "Menu",
      logo_url: String(formData.get("logo_url") ?? "").trim() || null,
      is_active: formData.get("is_active") === "on",
    })
    .eq("id", businessId);

  revalidatePath("/dashboard/settings");
}
