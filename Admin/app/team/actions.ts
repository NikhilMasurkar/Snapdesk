"use server";

import { revalidatePath } from "next/cache";
import { getAdmin, requireSuperAdmin } from "@/lib/admin";
import { writeAudit } from "@/lib/audit";
import { createServiceClient } from "@/lib/service";
import { ROLES, isAdmin, isSuperAdmin, type Role } from "@/lib/roles";
import type { ActionResult } from "../actions";

async function superAdminCount(
  service: ReturnType<typeof createServiceClient>
): Promise<number> {
  const { count } = await service
    .from("admin_users")
    .select("*", { count: "exact", head: true })
    .contains("roles", ["superadmin"]);
  return count ?? 0;
}

/**
 * Set a user's role set. Rules:
 * - admin + superadmin may ASSIGN (add) roles to anyone
 * - only superadmin may REMOVE a role someone already has, or grant superadmin
 * - nobody edits their own roles; the last superadmin can never be demoted
 */
export async function setAdminRoles(
  email: string,
  newRoles: Role[]
): Promise<ActionResult> {
  const { user: caller, roles: callerRoles } = await getAdmin();
  if (!isAdmin(callerRoles)) return { ok: false, error: "Not authorized." };

  const clean = email.trim().toLowerCase();
  if (!clean) return { ok: false, error: "Enter an email." };
  const roles = [...new Set(newRoles)];
  if (roles.length === 0) return { ok: false, error: "Pick at least one role." };
  if (roles.some((r) => !ROLES.includes(r))) return { ok: false, error: "Invalid role." };

  const service = createServiceClient();
  const { data, error } = await service.auth.admin.listUsers({ perPage: 1000 });
  if (error) return { ok: false, error: error.message };
  const target = data.users.find((u) => u.email?.toLowerCase() === clean);
  if (!target) {
    return { ok: false, error: "No account with that email. They must sign in once first." };
  }
  if (target.id === caller.id) {
    return { ok: false, error: "You can't change your own roles." };
  }

  const { data: existing } = await service
    .from("admin_users")
    .select("roles")
    .eq("user_id", target.id)
    .maybeSingle();
  const current: Role[] = (existing?.roles as Role[]) ?? [];

  const adding = roles.filter((r) => !current.includes(r));
  const removing = current.filter((r) => !roles.includes(r));

  if (adding.includes("superadmin") && !isSuperAdmin(callerRoles)) {
    return { ok: false, error: "Only a super admin can grant Super Admin." };
  }
  if (removing.length > 0 && !isSuperAdmin(callerRoles)) {
    return { ok: false, error: "Only a super admin can remove roles." };
  }
  if (removing.includes("superadmin") && (await superAdminCount(service)) <= 1) {
    return { ok: false, error: "There must be at least one super admin." };
  }

  const { error: upErr } = await service
    .from("admin_users")
    .upsert({ user_id: target.id, roles }, { onConflict: "user_id" });
  if (upErr) return { ok: false, error: upErr.message };

  await writeAudit(caller.id, "set_admin_role", "admin_user", target.id, {
    email: clean,
    roles,
    added: adding,
    removed: removing,
  });
  revalidatePath("/team");
  return { ok: true };
}

/** Revoke ALL admin access for a user. Super-admin only; never self / last SA. */
export async function removeAdmin(userId: string): Promise<ActionResult> {
  let adminId: string;
  try {
    adminId = (await requireSuperAdmin()).id;
  } catch {
    return { ok: false, error: "Only a super admin can remove members." };
  }
  if (userId === adminId) {
    return { ok: false, error: "You can't remove your own access." };
  }

  const service = createServiceClient();
  const { data: target } = await service
    .from("admin_users")
    .select("roles")
    .eq("user_id", userId)
    .maybeSingle();
  if (
    (target?.roles as Role[] | undefined)?.includes("superadmin") &&
    (await superAdminCount(service)) <= 1
  ) {
    return { ok: false, error: "Can't remove the last super admin." };
  }

  const { error } = await service.from("admin_users").delete().eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  await writeAudit(adminId, "remove_admin", "admin_user", userId, {});
  revalidatePath("/team");
  return { ok: true };
}
