import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOwnerBusiness, getOwnerFeatures } from "@/lib/dal";
import type { MenuItem, Order } from "@/lib/types";
import TableDetail from "./TableDetail";

const COUNTER_KEY = "__counter__";

export default async function TableDetailPage({
  params,
}: {
  params: Promise<{ table: string }>;
}) {
  const { table } = await params;
  const business = await getOwnerBusiness();
  if (!business) redirect("/dashboard");

  const features = await getOwnerFeatures(business.id);
  if (!features.tables_enabled) redirect("/dashboard/menu");

  const isCounter = table === COUNTER_KEY;
  const tableNo = isCounter ? null : decodeURIComponent(table);
  if (!isCounter && !tableNo) notFound();

  const supabase = await createClient();

  const ordersQuery = supabase
    .from("orders")
    .select("*")
    .eq("business_id", business.id)
    .in("status", ["approved"])
    .is("bill_id", null)
    .order("created_at", { ascending: true });

  const scoped = isCounter
    ? ordersQuery.is("table_no", null)
    : ordersQuery.eq("table_no", tableNo as string);

  const [{ data: orders }, { data: menuItems }] = await Promise.all([
    scoped,
    supabase
      .from("menu_items")
      .select("*")
      .eq("business_id", business.id)
      .eq("is_available", true)
      .order("name", { ascending: true }),
  ]);

  return (
    <TableDetail
      businessId={business.id}
      currency={business.currency}
      tableNo={tableNo}
      tableLabel={isCounter ? "Counter" : `Table ${tableNo}`}
      initialOrders={(orders ?? []) as Order[]}
      menuItems={(menuItems ?? []) as MenuItem[]}
    />
  );
}
