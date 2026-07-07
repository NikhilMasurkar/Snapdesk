import Link from "next/link";
import { getAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/service";
import { logout } from "@/app/login/actions";
import { money, dailySeries, timeWindows } from "@/lib/analytics";
import type { Business } from "@/lib/types";
import MiniBars from "./_components/MiniBars";
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
  const { som, todayStart: today, days30, days14 } = timeWindows();

  const [
    { data: businesses, error },
    usersResult,
    { data: billsData },
    { data: ordersData },
    { data: scansData },
  ] = await Promise.all([
    supabase.from("businesses").select("*").order("created_at", { ascending: false }),
    supabase.auth.admin.listUsers({ perPage: 1000 }),
    supabase
      .from("bills")
      .select("business_id, total, is_void, created_at")
      .gte("created_at", days30),
    supabase
      .from("orders")
      .select("business_id, created_at")
      .gte("created_at", days30),
    supabase.from("scan_events").select("business_id, created_at").gte("created_at", days14),
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

  // Demo businesses (10.7) are excluded from every platform figure.
  const demoIds = new Set(rows.filter((b) => b.is_demo).map((b) => b.id));
  const nameById = new Map(rows.map((b) => [b.id, b.name]));

  const bills = (billsData ?? []) as {
    business_id: string;
    total: number;
    is_void: boolean;
    created_at: string;
  }[];
  const orders = (ordersData ?? []) as { business_id: string; created_at: string }[];
  const scans = (scansData ?? []) as { business_id: string; created_at: string }[];

  const realPaidBills = bills.filter((b) => !b.is_void && !demoIds.has(b.business_id));
  const realOrders = orders.filter((o) => !demoIds.has(o.business_id));

  const revenueThisMonth = realPaidBills
    .filter((b) => b.created_at >= som)
    .reduce((s, b) => s + Number(b.total), 0);
  const ordersToday = realOrders.filter((o) => o.created_at >= today).length;
  const billsToday = realPaidBills.filter((b) => b.created_at >= today).length;

  const revenueSeries = dailySeries(realPaidBills, (b) => b.created_at, (b) => Number(b.total), 30);
  const ordersSeries = dailySeries(realOrders, (o) => o.created_at, () => 1, 30);

  // Top businesses by revenue this month.
  const revByBiz = new Map<string, number>();
  for (const b of realPaidBills.filter((b) => b.created_at >= som)) {
    revByBiz.set(b.business_id, (revByBiz.get(b.business_id) ?? 0) + Number(b.total));
  }
  const topBusinesses = [...revByBiz.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, rev]) => ({ id, name: nameById.get(id) ?? "—", rev }));

  // Needs attention: approved, non-demo businesses with zero scans in 14 days.
  const scannedBizIds = new Set(scans.map((s) => s.business_id));
  const churnRisk = approved.filter((b) => !b.is_demo && !scannedBizIds.has(b.id));

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-base font-bold tracking-tight">Snapdesk Admin</h1>
            <p className="text-xs text-zinc-500">{user.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/audit"
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
            >
              Audit log
            </Link>
            <form action={logout}>
              <button className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8">
        {error && (
          <p className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-300">
            Failed to load businesses: {error.message}
          </p>
        )}

        {/* Platform stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Pending" value={pending.length} accent={pending.length > 0} />
          <Stat label="Approved" value={approved.length} />
          <Stat label="Suspended" value={suspended.length} />
          <Stat label="Orders today" value={ordersToday} />
          <Stat label="Bills today" value={billsToday} />
          <Stat label="Revenue (month)" value={money(revenueThisMonth)} />
        </div>

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Revenue — last 30 days">
            <MiniBars data={revenueSeries} format={(v) => money(v)} />
          </ChartCard>
          <ChartCard title="Orders — last 30 days">
            <MiniBars data={ordersSeries} color="#38bdf8" />
          </ChartCard>
        </div>

        {/* Top businesses + needs attention */}
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Top businesses — revenue this month">
            {topBusinesses.length === 0 ? (
              <p className="py-6 text-center text-xs text-zinc-600">No revenue yet.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {topBusinesses.map((b) => (
                  <li key={b.id} className="flex items-center justify-between text-sm">
                    <Link href={`/business/${b.id}`} className="truncate hover:underline">
                      {b.name}
                    </Link>
                    <span className="tabular-nums text-zinc-300">{money(b.rev)}</span>
                  </li>
                ))}
              </ul>
            )}
          </ChartCard>
          <ChartCard title={`Needs attention — no scans in 14 days (${churnRisk.length})`}>
            {churnRisk.length === 0 ? (
              <p className="py-6 text-center text-xs text-zinc-600">
                All active businesses had recent scans.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {churnRisk.slice(0, 12).map((b) => (
                  <li key={b.id} className="flex items-center justify-between text-sm">
                    <Link href={`/business/${b.id}`} className="truncate hover:underline">
                      {b.name}
                    </Link>
                    <span className="text-xs text-amber-500">churn risk</span>
                  </li>
                ))}
              </ul>
            )}
          </ChartCard>
        </div>

        <BusinessList businesses={rows} menuBaseUrl={MENU_BASE_URL} />
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className={`mt-1 text-xl font-extrabold ${accent ? "text-amber-400" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-400">
        {title}
      </h2>
      {children}
    </section>
  );
}
