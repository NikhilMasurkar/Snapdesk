"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/dal";
import { type ActionResult, ok, fail } from "@/lib/action-result";

export type ApplicationInput = {
  // Business info
  name: string;
  type: "restaurant" | "parlour" | "bakery" | "other";
  tagline: string;
  whatsapp_number: string;
  opening_hours: string;
  // Location
  address: string;
  city: string;
  pincode: string;
  // Owner info
  owner_name: string;
  owner_phone: string;
  // Optional
  gst_number: string;
};

const TYPES = ["restaurant", "parlour", "bakery", "other"] as const;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

/**
 * Full business application (PHASE3_SPEC §5.1). Lands as status='pending' —
 * the DB default; the insert policy only allows pending, and the admin
 * approves from the Admin app. Slug is auto-generated; owners never see it.
 */
export async function submitApplication(input: ApplicationInput): Promise<ActionResult> {
  if (!input.name.trim()) return fail("Business name is required.");
  if (!TYPES.includes(input.type)) return fail("Pick a business type.");

  const whatsapp = input.whatsapp_number.replace(/\D/g, "");
  if (whatsapp.length < 10 || whatsapp.length > 15) {
    return fail("WhatsApp number must be 10–15 digits with country code, e.g. 919812345678.");
  }
  const ownerPhone = input.owner_phone.replace(/\D/g, "");
  if (ownerPhone.length < 10 || ownerPhone.length > 15) {
    return fail("Owner phone must be 10–15 digits.");
  }
  if (!input.owner_name.trim()) return fail("Owner name is required.");
  if (!input.address.trim()) return fail("Address is required.");
  if (!input.city.trim()) return fail("City is required.");
  const pincode = input.pincode.replace(/\D/g, "");
  if (pincode.length < 4 || pincode.length > 10) return fail("Enter a valid pincode.");

  const slug = slugify(input.name);
  if (!slug) return fail("Business name must contain letters or numbers.");

  const user = await requireUser();
  const supabase = await createClient();

  const row = {
    name: input.name.trim(),
    type: input.type,
    tagline: input.tagline.trim() || null,
    whatsapp_number: whatsapp,
    opening_hours: input.opening_hours.trim() || null,
    address: input.address.trim(),
    city: input.city.trim(),
    pincode,
    owner_name: input.owner_name.trim(),
    owner_phone: ownerPhone,
    gst_number: input.gst_number.trim() || null,
    owner_id: user.id,
  };

  let { error } = await supabase.from("businesses").insert({ ...row, slug });

  // Slug taken by another business → retry once with a random suffix.
  if (error?.code === "23505" && error.message.includes("slug")) {
    const suffixed = `${slug.slice(0, 34)}-${Math.random().toString(36).slice(2, 6)}`;
    ({ error } = await supabase.from("businesses").insert({ ...row, slug: suffixed }));
  }

  if (error?.code === "23505" && error.message.includes("one_business_per_owner")) {
    return fail("This account already has a business application.");
  }
  if (error) return fail(error.message);

  revalidatePath("/dashboard", "layout");
  return ok;
}
