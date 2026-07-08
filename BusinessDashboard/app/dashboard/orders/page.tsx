import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOwnerBusiness } from "@/lib/dal";
import type { Bill, Order } from "@/lib/types";
import OrdersView from "./OrdersView";

export const metadata = { title: "Orders · Snapdesk" };

export default async function OrdersPage() {
  const business = await getOwnerBusiness();
  if (!business) redirect("/dashboard");

  const supabase = await createClient();
  // Recent history; the live desk is on the Tables tab. RLS scopes to owner.
  const [{ data: orders }, { data: bills }] = await Promise.all([
    supabase
      .from("orders")
      .select("*")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("bills")
      .select("*")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  return (
    <OrdersView
      currency={business.currency}
      orders={(orders ?? []) as Order[]}
      bills={(bills ?? []) as Bill[]}
    />
  );
}
