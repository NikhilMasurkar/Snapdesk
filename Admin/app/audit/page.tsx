import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/service";
import type { AuditRow } from "@/lib/types";

const ACTION_LABEL: Record<string, string> = {
  approve_business: "Approved",
  reject_business: "Rejected",
  suspend_business: "Suspended",
  reactivate_business: "Reactivated",
  delete_business: "Deleted business",
  update_business: "Edited info",
  update_features: "Updated features",
  link_owner: "Re-linked owner",
  set_demo: "Set demo flag",
  delete_testimonial: "Deleted testimonial",
  create_page: "Created page",
  update_page: "Updated page",
  delete_page: "Deleted page",
  set_admin_role: "Set admin role",
  remove_admin: "Removed admin",
};

export default async function AuditPage() {
  const { isAdmin } = await getAdmin();
  if (!isAdmin) notFound();

  const service = createServiceClient();
  const [{ data: rows }, usersResult, { data: bizRows }] = await Promise.all([
    service
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300),
    service.auth.admin.listUsers({ perPage: 1000 }),
    service.from("businesses").select("id, name"),
  ]);

  const audit = (rows ?? []) as AuditRow[];
  const emailById = new Map(
    (usersResult.data?.users ?? []).map((u) => [u.id, u.email ?? ""])
  );
  const bizName = new Map(
    ((bizRows ?? []) as { id: string; name: string }[]).map((b) => [b.id, b.name])
  );

  const getActionBadgeClass = (action: string) => {
    if (action.startsWith("approve") || action.startsWith("reactivate")) {
      return "bg-success-bg text-success border-success/20";
    }
    if (action.startsWith("reject") || action.startsWith("suspend") || action.startsWith("delete")) {
      return "bg-danger-bg text-danger border-danger/20";
    }
    if (action.startsWith("update") || action.startsWith("link") || action.startsWith("set")) {
      return "bg-info-bg text-info border-info/20";
    }
    return "bg-muted-bg text-muted border-border";
  };

  return (
    <main className="min-h-screen bg-background text-foreground transition-colors duration-200 pb-16">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-card/85 backdrop-blur-md">
        <div className="flex w-full items-center gap-4 px-6 py-4 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-muted hover:text-foreground transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="size-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Dashboard
          </Link>
          <div className="h-6 w-px bg-border" />
          <h1 className="text-base font-bold tracking-tight text-foreground">Audit Log</h1>
        </div>
      </header>

      <div className="flex w-full flex-col px-6 py-8 lg:px-8">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-foreground">System Audit Trail</h2>
          <p className="text-xs text-muted mt-1">
            Real-time tracking of security operations, business validations, lifecycles, and configuration edits performed by administrators.
          </p>
        </div>

        {audit.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-12 px-4 text-center bg-card/30">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="size-10 text-muted mb-3"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.03 0 1.9.693 2.166 1.638m-7.377 2.24A9.019 9.019 0 0 1 6 12.018H3.75a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
              />
            </svg>
            <h3 className="text-sm font-bold text-foreground">No operations recorded</h3>
            <p className="mt-1 text-xs text-muted max-w-xs">Audit logs will automatically populate as admin mutations take place.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted-bg/30 text-[10px] font-bold uppercase tracking-wider text-muted">
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Administrator</th>
                    <th className="px-4 py-3">Operation</th>
                    <th className="px-4 py-3">Target Entity</th>
                    <th className="px-4 py-3">Parameters / Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {audit.map((r) => {
                    const targetName =
                      r.target_type === "business"
                        ? bizName.get(r.target_id)
                        : undefined;
                    return (
                      <tr key={r.id} className="hover:bg-muted-bg/30 transition-colors align-top">
                        <td className="whitespace-nowrap px-4 py-3.5 text-muted font-medium">
                          {new Date(r.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-foreground">
                          {emailById.get(r.admin_user_id) ?? "System Admin"}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${getActionBadgeClass(r.action)}`}>
                            {ACTION_LABEL[r.action] ?? r.action}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {r.target_type === "business" && targetName ? (
                            <Link
                              href={`/business/${r.target_id}`}
                              className="font-bold text-primary hover:text-primary-hover hover:underline"
                            >
                              {targetName}
                            </Link>
                          ) : (
                            <span className="font-mono text-muted text-[10px] bg-muted-bg px-1.5 py-0.5 rounded border border-border/50">
                              {r.target_type}:{r.target_id.slice(0, 8)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          {r.detail ? (
                            <div className="max-w-md overflow-x-auto rounded bg-muted-bg/50 border border-border/60 p-2 font-mono text-[10px] text-foreground leading-snug">
                              <pre className="whitespace-pre-wrap break-all">
                                {JSON.stringify(r.detail, null, 2)}
                              </pre>
                            </div>
                          ) : (
                            <span className="text-muted italic">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
