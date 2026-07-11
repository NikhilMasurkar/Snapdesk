import { notFound } from "next/navigation";
import { getAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/service";
import { canAssignRoles, canSalesMember, isSuperAdmin, type Role } from "@/lib/roles";
import TeamManager from "./TeamManager";
import AdminShell from "../_components/AdminShell";

export default async function TeamPage() {
  const { user, roles } = await getAdmin();
  // Admin + superadmin can assign; anyone else doesn't see this page exists.
  if (!canAssignRoles(roles)) notFound();

  const service = createServiceClient();
  const [{ data: rows }, usersResult] = await Promise.all([
    service.from("admin_users").select("user_id, roles, created_at"),
    service.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const emailById = new Map(
    (usersResult.data?.users ?? []).map((u) => [u.id, u.email ?? ""])
  );

  const members = ((rows ?? []) as { user_id: string; roles: Role[] }[])
    .map((r) => ({
      userId: r.user_id,
      roles: r.roles ?? [],
      email: emailById.get(r.user_id) ?? "(unknown)",
    }))
    .sort((a, b) => a.email.localeCompare(b.email));

  return (
    <AdminShell
      userEmail={user.email ?? ""}
      isSuperAdmin={isSuperAdmin(roles)}
      showSales={canSalesMember(roles)}
      initialTab="role-config"
    >
      <div className="flex w-full flex-col px-6 py-8 lg:px-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold tracking-tight text-foreground">Employee — Role Config</h1>
          <p className="text-xs text-muted mt-1">
            Assign and manage administrator & employee roles across the platform.
          </p>
        </div>
        <TeamManager
          members={members}
          currentUserId={user.id}
          callerIsSuper={isSuperAdmin(roles)}
        />
      </div>
    </AdminShell>
  );
}
