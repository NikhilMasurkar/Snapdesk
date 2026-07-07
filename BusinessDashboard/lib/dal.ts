import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Business, BusinessFeatures } from "@/lib/types";

// cache() dedupes these within a single request — the dashboard layout and
// every page both call them, which would otherwise double every query.

export const requireUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  return user;
});

/** The single business this owner manages, or null if not yet linked. */
export const getOwnerBusiness = cache(async (): Promise<Business | null> => {
  const user = await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  return (data as Business) ?? null;
});

/**
 * Feature flags for the owner's business. Falls back to all-on (matching the
 * DB defaults) if the row is missing, so a backfill gap never hides features.
 */
export const getOwnerFeatures = cache(
  async (businessId: string): Promise<BusinessFeatures> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("business_features")
      .select("*")
      .eq("business_id", businessId)
      .maybeSingle();

    return (
      (data as BusinessFeatures) ?? {
        business_id: businessId,
        ordering_enabled: true,
        testimonials_enabled: true,
        photos_enabled: true,
        analytics_enabled: false,
        tables_enabled: true,
        max_menu_items: 30,
      }
    );
  }
);
