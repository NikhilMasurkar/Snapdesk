import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/service";
import { isSuperAdmin, type Role, type Roles } from "@/lib/roles";

/**
 * PHASE3_SPEC §4.1: a session must exist AND the user must have a row in
 * admin_users. The lookup uses the service client because admin_users has
 * RLS enabled with no policies (unreachable via anon/authenticated keys —
 * that's the point). `role` drives the Admin-site RBAC (lib/roles.ts).
 */
export const getAdmin = cache(
  async (): Promise<{ user: User; isAdmin: boolean; roles: Roles }> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const service = createServiceClient();
    const { data } = await service
      .from("admin_users")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    // Compat shim: pre-migration rows have a single `role`, post-migration
    // a `roles` array. Normalize to an array either way.
    const row = data as { roles?: Role[]; role?: Role } | null;
    const roles: Roles = row?.roles ?? (row?.role ? [row.role] : null);

    return { user, isAdmin: !!row, roles };
  }
);

/** For server actions: throws instead of rendering, so callers can't skip it. */
export async function requireAdmin(): Promise<User> {
  const { user, isAdmin } = await getAdmin();
  if (!isAdmin) throw new Error("Not authorized");
  return user;
}

/** Removals / superadmin grants are super-admin only. */
export async function requireSuperAdmin(): Promise<User> {
  const { user, roles } = await getAdmin();
  if (!isSuperAdmin(roles)) throw new Error("Not authorized");
  return user;
}
