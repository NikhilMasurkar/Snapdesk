"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function client() {
  return createClient();
}

export async function addCategory(businessId: string, name: string) {
  if (!name.trim()) return;
  const supabase = await client();
  await supabase.from("categories").insert({ business_id: businessId, name: name.trim(), sort_order: 999 });
  revalidatePath("/dashboard/menu");
}

export async function renameCategory(categoryId: string, name: string) {
  if (!name.trim()) return;
  const supabase = await client();
  await supabase.from("categories").update({ name: name.trim() }).eq("id", categoryId);
  revalidatePath("/dashboard/menu");
}

export async function deleteCategory(categoryId: string) {
  const supabase = await client();
  await supabase.from("categories").delete().eq("id", categoryId);
  revalidatePath("/dashboard/menu");
}

export type ItemInput = {
  name: string;
  description: string;
  is_veg: "veg" | "non-veg" | "na";
  has_portions: boolean;
  price_full: string;
  price_half: string;
};

function toItemRow(businessId: string, categoryId: string | null, input: ItemInput) {
  return {
    business_id: businessId,
    category_id: categoryId,
    name: input.name.trim(),
    description: input.description.trim() || null,
    is_veg: input.is_veg === "na" ? null : input.is_veg === "veg",
    has_portions: input.has_portions,
    price_full: Number(input.price_full),
    price_half: input.has_portions && input.price_half ? Number(input.price_half) : null,
  };
}

export async function addItem(businessId: string, categoryId: string | null, input: ItemInput) {
  if (!input.name.trim() || !input.price_full) return;
  const supabase = await client();
  await supabase.from("menu_items").insert({ ...toItemRow(businessId, categoryId, input), sort_order: 999 });
  revalidatePath("/dashboard/menu");
}

export async function updateItem(
  itemId: string,
  businessId: string,
  categoryId: string | null,
  input: ItemInput
) {
  if (!input.name.trim() || !input.price_full) return;
  const supabase = await client();
  await supabase.from("menu_items").update(toItemRow(businessId, categoryId, input)).eq("id", itemId);
  revalidatePath("/dashboard/menu");
}

export async function deleteItem(itemId: string) {
  const supabase = await client();
  await supabase.from("menu_items").delete().eq("id", itemId);
  revalidatePath("/dashboard/menu");
}

export async function toggleAvailability(itemId: string, isAvailable: boolean) {
  const supabase = await client();
  await supabase.from("menu_items").update({ is_available: isAvailable }).eq("id", itemId);
  revalidatePath("/dashboard/menu");
}
