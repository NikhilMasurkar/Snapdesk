import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOwnerBusiness, getOwnerFeatures } from "@/lib/dal";
import type { Order } from "@/lib/types";
import TablesGrid from "./TablesGrid";

export const metadata = { title: "Tables · Snapdesk" };

export default async function TablesPage() {
  const business = await getOwnerBusiness();
  if (!business) redirect("/dashboard");

  const features = await getOwnerFeatures(business.id);
  // Counter-mode businesses (bakery/parlour) don't use the table grid.
  if (!features.tables_enabled) redirect("/dashboard/menu");

  const supabase = await createClient();
  // Open orders = everything not yet billed or rejected. These drive the grid.
  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("business_id", business.id)
    .in("status", ["pending", "approved"])
    .order("created_at", { ascending: true });

  const orders = (data ?? []) as Order[];

  return (
    <TablesGrid
      businessId={business.id}
      tableCount={business.table_count}
      currency={business.currency}
      acceptingOrders={business.accepting_orders}
      initialOrders={orders}
    />
  );
}
