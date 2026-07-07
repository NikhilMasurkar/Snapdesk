import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOwnerBusiness } from "@/lib/dal";
import type { Bill } from "@/lib/types";
import BillView from "./BillView";

export default async function BillPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const { id } = await params;
  const { print } = await searchParams;
  const business = await getOwnerBusiness();
  if (!business) redirect("/dashboard");

  const supabase = await createClient();
  const { data } = await supabase
    .from("bills")
    .select("*")
    .eq("id", id)
    .eq("business_id", business.id)
    .maybeSingle();

  if (!data) notFound();

  return (
    <BillView
      bill={data as Bill}
      business={{
        name: business.name,
        logo_url: business.logo_url,
        address: business.address,
        city: business.city,
        gst_number: business.gst_number,
        currency: business.currency,
      }}
      autoPrint={print === "1"}
    />
  );
}
