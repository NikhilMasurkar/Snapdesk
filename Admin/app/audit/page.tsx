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

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link href="/" className="text-sm text-zinc-500 hover:text-white">
            ← Admin
          </Link>
          <h1 className="text-base font-bold tracking-tight">Audit log</h1>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8">
        {audit.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-800 py-10 text-center text-sm text-zinc-500">
            No admin actions recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900 text-zinc-500">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Admin</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Target</th>
                  <th className="px-3 py-2">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {audit.map((r) => {
                  const targetName =
                    r.target_type === "business"
                      ? bizName.get(r.target_id)
                      : undefined;
                  return (
                    <tr key={r.id} className="align-top">
                      <td className="whitespace-nowrap px-3 py-2 text-zinc-500">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-zinc-400">
                        {emailById.get(r.admin_user_id) ?? "admin"}
                      </td>
                      <td className="px-3 py-2 font-semibold">
                        {ACTION_LABEL[r.action] ?? r.action}
                      </td>
                      <td className="px-3 py-2">
                        {r.target_type === "business" && targetName ? (
                          <Link
                            href={`/business/${r.target_id}`}
                            className="text-zinc-300 hover:underline"
                          >
                            {targetName}
                          </Link>
                        ) : (
                          <span className="text-zinc-500">
                            {r.target_type} {r.target_id.slice(0, 8)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-zinc-500">
                        {r.detail ? (
                          <code className="text-[11px]">
                            {JSON.stringify(r.detail).slice(0, 120)}
                          </code>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
