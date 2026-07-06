import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/service";

/**
 * PHASE3_SPEC §4.1: a session must exist AND the user must have a row in
 * admin_users. The lookup uses the service client because admin_users has
 * RLS enabled with no policies (unreachable via anon/authenticated keys —
 * that's the point).
 */
export const getAdmin = cache(
  async (): Promise<{ user: User; isAdmin: boolean }> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const service = createServiceClient();
    const { data } = await service
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    return { user, isAdmin: !!data };
  }
);

/** For server actions: throws instead of rendering, so callers can't skip it. */
export async function requireAdmin(): Promise<User> {
  const { user, isAdmin } = await getAdmin();
  if (!isAdmin) throw new Error("Not authorized");
  return user;
}
