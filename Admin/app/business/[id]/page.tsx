import { getBusiness } from "@/lib/business";
import { createServiceClient } from "@/lib/service";
import type { BusinessFeatures } from "@/lib/types";
import BusinessAdmin, { TableQrManager } from "./BusinessAdmin";

const MENU_BASE_URL =
  process.env.NEXT_PUBLIC_MENU_BASE_URL ?? "https://snapdesk-tan.vercel.app";

export default async function OverviewTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const business = (await getBusiness(id))!; // layout already guaranteed it
  const service = createServiceClient();

  const featRes = await service
    .from("business_features")
    .select("*")
    .eq("business_id", id)
    .maybeSingle();

  const features: BusinessFeatures = featRes.data ?? {
    business_id: id,
    ordering_enabled: true,
    testimonials_enabled: true,
    photos_enabled: true,
    analytics_enabled: true,
    tables_enabled: true,
    qr_download_enabled: true,
    max_menu_items: 500,
  };

  if (business.owner_id) {
    const { data } = await service.auth.admin.getUserById(business.owner_id);
    business.owner_email = data.user?.email ?? undefined;
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <BusinessAdmin business={business} features={features} />
      </div>

      <div className="flex flex-col gap-6">
        <TableQrManager business={business} menuBaseUrl={MENU_BASE_URL} />
      </div>
    </div>
  );
}
