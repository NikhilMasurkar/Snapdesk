import { getOwnerBusiness } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import type { Category, MenuItem } from "@/lib/types";
import MenuEditor from "./MenuEditor";

export default async function MenuPage() {
  const business = await getOwnerBusiness();
  if (!business) return null; // layout already handles this case

  const supabase = await createClient();
  const [categoriesRes, itemsRes] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .eq("business_id", business.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("menu_items")
      .select("*")
      .eq("business_id", business.id)
      .order("sort_order", { ascending: true }),
  ]);

  return (
    <MenuEditor
      businessId={business.id}
      currency={business.currency}
      categories={(categoriesRes.data ?? []) as Category[]}
      items={(itemsRes.data ?? []) as MenuItem[]}
    />
  );
}
