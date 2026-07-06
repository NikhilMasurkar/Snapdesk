import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import type {
  Business,
  BusinessFeatures,
  Category,
  MenuItem,
  MenuSection,
  Testimonial,
} from "@/lib/types";
import MenuClient from "./CartClient";
import ReviewsSection from "./ReviewsSection";
import ScanTracker from "./ScanTracker";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ table?: string | string[] }>;
};

async function fetchBusiness(slug: string): Promise<Business | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("businesses")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  return (data as Business) ?? null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const business = await fetchBusiness(slug);
  if (!business) return { title: "Menu not available" };
  return {
    title: `${business.name} – ${business.menu_label}`,
    description: business.tagline ?? `Order from ${business.name} on WhatsApp`,
  };
}

export default async function MenuPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const rawTable = Array.isArray(sp.table) ? sp.table[0] : sp.table;
  const table = rawTable?.trim() ? rawTable.trim() : null;

  const business = await fetchBusiness(slug);
  if (!business) notFound();

  const supabase = getSupabase();
  const [categoriesRes, itemsRes, testimonialsRes, statsRes, featuresRes] =
    await Promise.all([
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
      supabase
        .from("testimonials")
        .select("*")
        .eq("business_id", business.id)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(5),
      // True totals across ALL approved reviews (view: business_review_stats)
      supabase
        .from("business_review_stats")
        .select("review_count, avg_rating")
        .eq("business_id", business.id)
        .maybeSingle(),
      supabase
        .from("business_features")
        .select("ordering_enabled, testimonials_enabled, photos_enabled")
        .eq("business_id", business.id)
        .maybeSingle(),
    ]);

  const categories = (categoriesRes.data ?? []) as Category[];
  const items = (itemsRes.data ?? []) as MenuItem[];
  const testimonials = (testimonialsRes.data ?? []) as Testimonial[];

  // Default every flag ON if the features row is missing, so a menu never
  // silently loses ordering/reviews because of a backfill gap.
  const features = (featuresRes.data as BusinessFeatures | null) ?? {
    ordering_enabled: true,
    testimonials_enabled: true,
    photos_enabled: true,
  };

  // Fall back to the fetched page if the stats view isn't available.
  const stats = statsRes.data as { review_count: number; avg_rating: number } | null;
  const totalCount = stats?.review_count ?? testimonials.length;
  const avgRating =
    stats?.avg_rating != null
      ? Number(stats.avg_rating)
      : testimonials.length > 0
        ? testimonials.reduce((sum, t) => sum + t.rating, 0) / testimonials.length
        : 0;

  // Strip photos entirely when the plan doesn't include them.
  const menuItems = features.photos_enabled
    ? items
    : items.map((i) => ({ ...i, photo_url: null }));

  const sections: MenuSection[] = categories
    .map((c) => ({
      id: c.id,
      name: c.name,
      items: menuItems.filter((i) => i.category_id === c.id),
    }))
    .filter((s) => s.items.length > 0);

  const uncategorized = menuItems.filter(
    (i) => !categories.some((c) => c.id === i.category_id)
  );
  if (uncategorized.length > 0) {
    sections.push({ id: "other", name: "Other", items: uncategorized });
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col bg-white shadow-sm">
      <ScanTracker businessId={business.id} table={table} />
      <MenuClient
        slug={business.slug}
        businessId={business.id}
        businessName={business.name}
        whatsappNumber={business.whatsapp_number}
        currency={business.currency}
        logoUrl={business.logo_url}
        tagline={business.tagline}
        menuLabel={business.menu_label}
        sections={sections}
        tableFromUrl={table}
        orderingEnabled={features.ordering_enabled}
        acceptingOrders={business.accepting_orders}
      />
      {features.testimonials_enabled && (
        <ReviewsSection
          businessId={business.id}
          slug={business.slug}
          initialReviews={testimonials}
          totalCount={totalCount}
          avgRating={avgRating}
        />
      )}
      <footer className="px-4 pb-32 pt-8 text-center text-xs text-zinc-400">
        Powered by Snapdesk
      </footer>
    </div>
  );
}
