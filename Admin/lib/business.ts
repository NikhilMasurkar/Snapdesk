import "server-only";
import { cache } from "react";
import { createServiceClient } from "@/lib/service";
import type { Business } from "@/lib/types";

// cache() dedupes within a request so the [id] layout + tab page don't both
// hit the DB for the same business.
export const getBusiness = cache(async (id: string): Promise<Business | null> => {
  const { data } = await createServiceClient()
    .from("businesses")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as Business) ?? null;
});
