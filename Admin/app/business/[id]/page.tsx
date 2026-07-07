import { getBusiness } from "@/lib/business";
import { createServiceClient } from "@/lib/service";
import type { BusinessFeatures, Testimonial } from "@/lib/types";
import BusinessAdmin from "./BusinessAdmin";
import QrPackButton from "./QrPackButton";

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

  const [featRes, testiRes] = await Promise.all([
    service.from("business_features").select("*").eq("business_id", id).maybeSingle(),
    service
      .from("testimonials")
      .select("*")
      .eq("business_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const features =
    (featRes.data as BusinessFeatures) ?? {
      business_id: id,
      ordering_enabled: true,
      testimonials_enabled: true,
      photos_enabled: true,
      analytics_enabled: false,
      tables_enabled: true,
      max_menu_items: 30,
    };
  const testimonials = (testiRes.data ?? []) as Testimonial[];

  if (business.owner_id) {
    const { data } = await service.auth.admin.getUserById(business.owner_id);
    business.owner_email = data.user?.email ?? undefined;
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <BusinessAdmin business={business} features={features} testimonials={testimonials} />
      </div>

      <div className="flex flex-col gap-6">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="size-4 text-primary">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
            </svg>
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted">QR Code Package</h2>
          </div>
          <p className="mb-4 text-xs text-muted leading-relaxed">
            Deterministic print-ready A4 PDF with{" "}
            <span className="font-bold text-foreground">{business.table_count} tables</span> and a
            counter code.
          </p>
          <QrPackButton
            slug={business.slug}
            businessName={business.name}
            tableCount={business.table_count}
            menuBaseUrl={MENU_BASE_URL}
          />
        </section>
      </div>
    </div>
  );
}
