import { notFound } from "next/navigation";
import { getAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/service";
import { canSalesManager, canSalesMember, isSuperAdmin, type Role } from "@/lib/roles";
import type { Lead, LeadRemark } from "@/lib/types";
import AdminShell from "../_components/AdminShell";
import LeadsManager from "./LeadsManager";

const SALES_ROLES: Role[] = ["snap_sales_manager", "snap_sales_member", "admin", "superadmin"];

export default async function LeadsPage() {
  const { user, roles } = await getAdmin();
  if (!canSalesMember(roles)) notFound();
  const isManager = canSalesManager(roles);

  const service = createServiceClient();

  // members see only their own leads; managers see everything
  let leadsQuery = service.from("leads").select("*").order("created_at", { ascending: false });
  if (!isManager) leadsQuery = leadsQuery.eq("assigned_to", user.id);

  const [{ data: leadRows }, { data: teamRows }, usersResult] = await Promise.all([
    leadsQuery,
    service.from("admin_users").select("user_id, roles").overlaps("roles", SALES_ROLES),
    service.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const emailById = new Map(
    (usersResult.data?.users ?? []).map((u) => [u.id, u.email ?? ""])
  );

  const leads = ((leadRows ?? []) as Lead[]).map((l) => ({
    ...l,
    assigned_email: l.assigned_to ? emailById.get(l.assigned_to) : undefined,
  }));

  // remarks for the listed leads, newest first
  const leadIds = leads.map((l) => l.id);
  const { data: remarkRows } = leadIds.length
    ? await service
        .from("lead_remarks")
        .select("*")
        .in("lead_id", leadIds)
        .order("created_at", { ascending: false })
    : { data: [] };
  const remarksByLead = new Map<string, LeadRemark[]>();
  for (const r of (remarkRows ?? []) as LeadRemark[]) {
    const list = remarksByLead.get(r.lead_id) ?? [];
    list.push({ ...r, author_email: emailById.get(r.author_id) });
    remarksByLead.set(r.lead_id, list);
  }
  for (const l of leads) l.remarks = remarksByLead.get(l.id) ?? [];

  const salesTeam = ((teamRows ?? []) as { user_id: string }[])
    .map((r) => ({ userId: r.user_id, email: emailById.get(r.user_id) ?? "(unknown)" }))
    .sort((a, b) => a.email.localeCompare(b.email));

  return (
    <AdminShell
      userEmail={user.email ?? ""}
      isSuperAdmin={isSuperAdmin(roles)}
      showSales
      initialTab="leads"
    >
      <div className="mx-auto w-full max-w-[1600px] px-6 py-8 lg:px-10">
        <div className="mb-6">
          <h1 className="text-xl font-bold tracking-tight text-foreground">Sales — Leads</h1>
          <p className="text-xs text-muted mt-1">
            {isManager
              ? "All internal leads. Add, assign, and track calls."
              : "Leads assigned to you. Log every call with a remark."}
          </p>
        </div>
        <LeadsManager leads={leads} salesTeam={salesTeam} isManager={isManager} />
      </div>
    </AdminShell>
  );
}
