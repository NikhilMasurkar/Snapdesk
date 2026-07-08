import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/service";
import { canManageTeam, type Role } from "@/lib/roles";
import TeamManager from "./TeamManager";

export default async function TeamPage() {
  const { role } = await getAdmin();
  // Team/role management is super-admin only; hide it from everyone else.
  if (!canManageTeam(role)) notFound();

  const service = createServiceClient();
  const [{ data: rows }, usersResult] = await Promise.all([
    service.from("admin_users").select("user_id, role, created_at"),
    service.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const emailById = new Map(
    (usersResult.data?.users ?? []).map((u) => [u.id, u.email ?? ""])
  );

  const members = ((rows ?? []) as { user_id: string; role: Role; created_at: string }[])
    .map((r) => ({
      userId: r.user_id,
      role: r.role,
      email: emailById.get(r.user_id) ?? "(unknown)",
    }))
    .sort((a, b) => a.email.localeCompare(b.email));

  return (
    <main className="min-h-screen bg-background text-foreground transition-colors duration-200 pb-16">
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
          <h1 className="text-base font-bold tracking-tight text-foreground">Team & Roles</h1>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-6 py-8 lg:px-8">
        <TeamManager members={members} />
      </div>
    </main>
  );
}
