import { getAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/service";
import { logout } from "@/app/login/actions";
import type { Business } from "@/lib/types";
import BusinessList from "./BusinessList";

const MENU_BASE_URL =
  process.env.NEXT_PUBLIC_MENU_BASE_URL ?? "https://snapdesk-tan.vercel.app";

export default async function AdminPage() {
  const { user, isAdmin } = await getAdmin();

  if (!isAdmin) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-950 px-6 text-center">
        <h1 className="text-lg font-bold text-white">Access denied</h1>
        <p className="max-w-sm text-sm text-zinc-400">
          <strong>{user.email}</strong> is not an admin account. Insert this
          user into the <code className="text-zinc-300">admin_users</code> table
          if this is a mistake.
        </p>
        <form action={logout}>
          <button className="mt-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300">
            Log out
          </button>
        </form>
      </main>
    );
  }

  const supabase = createServiceClient();

  const [{ data: businesses, error }, usersResult] = await Promise.all([
    supabase
      .from("businesses")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const emailById = new Map(
    (usersResult.data?.users ?? []).map((u) => [u.id, u.email ?? ""])
  );
  const rows: Business[] = ((businesses ?? []) as Business[]).map((b) => ({
    ...b,
    owner_email: b.owner_id ? emailById.get(b.owner_id) : undefined,
  }));

  const pending = rows.filter((b) => b.status === "pending");
  const approved = rows.filter((b) => b.status === "approved");
  const suspended = rows.filter((b) => b.status === "suspended");

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-base font-bold tracking-tight">Snapdesk Admin</h1>
            <p className="text-xs text-zinc-500">{user.email}</p>
          </div>
          <form action={logout}>
            <button className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800">
              Log out
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8">
        {error && (
          <p className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-300">
            Failed to load businesses: {error.message}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Pending applications" value={pending.length} accent={pending.length > 0} />
          <Stat label="Approved" value={approved.length} />
          <Stat label="Suspended" value={suspended.length} />
          <Stat label="Total businesses" value={rows.length} />
        </div>

        <BusinessList businesses={rows} menuBaseUrl={MENU_BASE_URL} />
      </div>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold ${accent ? "text-amber-400" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}
