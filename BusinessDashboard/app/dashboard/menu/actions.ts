"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/dal";
import { type ActionResult, ok, fail } from "@/lib/action-result";

// RLS (owner_id = auth.uid()) is the security boundary; requireUser() here
// just fails fast with a clear message instead of a silent no-op write.

export async function addCategory(
  businessId: string,
  name: string
): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return fail("Category name is required.");

  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .insert({ business_id: businessId, name: trimmed, sort_order: 999 });

  if (error) return fail(error.message);
  revalidatePath("/dashboard/menu");
  return ok;
}

export async function renameCategory(
  categoryId: string,
  name: string
): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return fail("Category name is required.");

  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({ name: trimmed })
    .eq("id", categoryId);

  if (error) return fail(error.message);
  revalidatePath("/dashboard/menu");
  return ok;
}

export async function deleteCategory(categoryId: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", categoryId);

  if (error) return fail(error.message);
  revalidatePath("/dashboard/menu");
  return ok;
}

export type ItemInput = {
  name: string;
  description: string;
  is_veg: "veg" | "non-veg" | "na";
  has_portions: boolean;
  price_full: string;
  price_half: string;
};

function validateItem(input: ItemInput): string | null {
  if (!input.name.trim()) return "Item name is required.";
  const full = Number(input.price_full);
  if (!input.price_full || Number.isNaN(full) || full <= 0)
    return "Price must be a positive number.";
  if (input.has_portions) {
    const half = Number(input.price_half);
    if (!input.price_half || Number.isNaN(half) || half <= 0)
      return "Half price must be a positive number.";
  }
  return null;
}

function toItemRow(businessId: string, categoryId: string | null, input: ItemInput) {
  return {
    business_id: businessId,
    category_id: categoryId,
    name: input.name.trim(),
    description: input.description.trim() || null,
    is_veg: input.is_veg === "na" ? null : input.is_veg === "veg",
    has_portions: input.has_portions,
    price_full: Number(input.price_full),
    price_half: input.has_portions ? Number(input.price_half) : null,
  };
}

export async function addItem(
  businessId: string,
  categoryId: string | null,
  input: ItemInput
): Promise<ActionResult> {
  const invalid = validateItem(input);
  if (invalid) return fail(invalid);

  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("menu_items")
    .insert({ ...toItemRow(businessId, categoryId, input), sort_order: 999 });

  if (error) return fail(error.message);
  revalidatePath("/dashboard/menu");
  return ok;
}

export async function updateItem(
  itemId: string,
  businessId: string,
  categoryId: string | null,
  input: ItemInput
): Promise<ActionResult> {
  const invalid = validateItem(input);
  if (invalid) return fail(invalid);

  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("menu_items")
    .update(toItemRow(businessId, categoryId, input))
    .eq("id", itemId);

  if (error) return fail(error.message);
  revalidatePath("/dashboard/menu");
  return ok;
}

export async function deleteItem(itemId: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("menu_items").delete().eq("id", itemId);

  if (error) return fail(error.message);
  revalidatePath("/dashboard/menu");
  return ok;
}

export async function toggleAvailability(
  itemId: string,
  isAvailable: boolean
): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("menu_items")
    .update({ is_available: isAvailable })
    .eq("id", itemId);

  if (error) return fail(error.message);
  revalidatePath("/dashboard/menu");
  return ok;
}
