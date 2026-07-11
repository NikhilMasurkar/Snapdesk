import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOwnerBusiness, getOwnerFeatures } from "@/lib/dal";
import type { Order } from "@/lib/types";
import KitchenBoard from "./KitchenBoard";

export const metadata = { title: "Kitchen · Snapdesk" };

/**
 * Kitchen Display Screen: open this on a tablet in the kitchen, tap the
 * fullscreen button, done. Web-based on purpose — no native app needed for
 * a wall screen; Supabase Realtime pushes orders the moment they're approved.
 */
export default async function KitchenPage() {
  const business = await getOwnerBusiness();
  if (!business) redirect("/dashboard");

  const features = await getOwnerFeatures(business.id);
  if (!features.ordering_enabled && !features.tables_enabled) {
    redirect("/dashboard/menu");
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("business_id", business.id)
    .in("status", ["pending", "approved"])
    .order("created_at", { ascending: true });

  return (
    <KitchenBoard
      businessId={business.id}
      businessName={business.name}
      initialOrders={(data ?? []) as Order[]}
    />
  );
}
