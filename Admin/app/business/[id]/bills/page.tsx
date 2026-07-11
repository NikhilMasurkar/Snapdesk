import { createServiceClient } from "@/lib/service";
import type { Bill } from "@/lib/types";
import RevenueAnalytics from "./RevenueAnalytics";

export default async function BillsTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Fetch up to 1000 bills for full daily/monthly/yearly analytics
  const { data } = await createServiceClient()
    .from("bills")
    .select("*")
    .eq("business_id", id)
    .order("created_at", { ascending: false })
    .limit(1000);
  const bills = (data ?? []) as Bill[];

  return <RevenueAnalytics bills={bills} />;
}
