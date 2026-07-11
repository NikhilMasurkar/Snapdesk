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

  const activeOrdersQuery = supabase
    .from("orders")
    .select("*")
    .eq("business_id", business.id)
    .in("status", ["approved"])
    .is("bill_id", null)
    .order("created_at", { ascending: true });

  const prevOrdersQuery = supabase
    .from("orders")
    .select("*")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .limit(30);

  const prevBillsQuery = supabase
    .from("bills")
    .select("*")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const activeScoped = isCounter
    ? activeOrdersQuery.is("table_no", null)
    : activeOrdersQuery.eq("table_no", tableNo as string);

  const prevOrdersScoped = isCounter
    ? prevOrdersQuery.is("table_no", null)
    : prevOrdersQuery.eq("table_no", tableNo as string);

  const prevBillsScoped = isCounter
    ? prevBillsQuery.is("table_no", null)
    : prevBillsQuery.eq("table_no", tableNo as string);

  const [
    { data: orders },
    { data: menuItems },
    { data: previousOrders },
    { data: previousBills },
  ] = await Promise.all([
    activeScoped,
    supabase
      .from("menu_items")
      .select("*")
      .eq("business_id", business.id)
      .eq("is_available", true)
      .order("name", { ascending: true }),
    prevOrdersScoped,
    prevBillsScoped,
  ]);

  const menuBaseUrl = process.env.NEXT_PUBLIC_MENU_BASE_URL || "http://localhost:3000";

  return (
    <TableDetail
      businessId={business.id}
      businessSlug={business.slug}
      businessName={business.name}
      businessLogoUrl={business.logo_url}
      currency={business.currency}
      tableNo={tableNo}
      tableLabel={isCounter ? "Counter" : `Table ${tableNo}`}
      menuBaseUrl={menuBaseUrl}
      initialOrders={(orders ?? []) as Order[]}
      previousOrders={(previousOrders ?? []) as Order[]}
      previousBills={(previousBills ?? []) as any[]}
      menuItems={(menuItems ?? []) as MenuItem[]}
    />
  );
}
