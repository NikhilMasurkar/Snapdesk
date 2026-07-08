"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/admin";
import { writeAudit } from "@/lib/audit";
import { createServiceClient } from "@/lib/service";
import { ROLES, type Role } from "@/lib/roles";
import type { ActionResult } from "../actions";

/** Grant an admin-site role to a user (by email), or change their role. */
export async function setAdminRole(email: string, role: Role): Promise<ActionResult> {
  let adminId: string;
  try {
    adminId = (await requireSuperAdmin()).id;
  } catch {
    return { ok: false, error: "Only a super admin can manage roles." };
  }
  if (!ROLES.includes(role)) return { ok: false, error: "Invalid role." };

  const clean = email.trim().toLowerCase();
  if (!clean) return { ok: false, error: "Enter an email." };

  const service = createServiceClient();
  const { data, error } = await service.auth.admin.listUsers({ perPage: 1000 });
  if (error) return { ok: false, error: error.message };
  const user = data.users.find((u) => u.email?.toLowerCase() === clean);
  if (!user) {
    return {
      ok: false,
      error: "No account with that email. They must sign in once first.",
    };
  }

  const { error: upErr } = await service
    .from("admin_users")
    .upsert({ user_id: user.id, role }, { onConflict: "user_id" });
  if (upErr) return { ok: false, error: upErr.message };

  await writeAudit(adminId, "set_admin_role", "admin_user", user.id, { email: clean, role });
  revalidatePath("/team");
  return { ok: true };
}

/** Revoke all admin access for a user. Can't remove yourself. */
export async function removeAdmin(userId: string): Promise<ActionResult> {
  let adminId: string;
  try {
    adminId = (await requireSuperAdmin()).id;
  } catch {
    return { ok: false, error: "Only a super admin can manage roles." };
  }
  if (userId === adminId) {
    return { ok: false, error: "You can't remove your own access." };
  }

  const service = createServiceClient();
  const { error } = await service.from("admin_users").delete().eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  await writeAudit(adminId, "remove_admin", "admin_user", userId, {});
  revalidatePath("/team");
  return { ok: true };
}
