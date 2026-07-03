import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Business } from "@/lib/types";

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
