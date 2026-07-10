import Link from "next/link";
import { getAdmin } from "@/lib/admin";
import { canAssignRoles } from "@/lib/roles";
import { createServiceClient } from "@/lib/service";
import { logout } from "@/app/login/actions";
import { money, dailySeries, timeWindows } from "@/lib/analytics";
import type { Business } from "@/lib/types";
import MiniBars from "./_components/MiniBars";
import BusinessList from "./BusinessList";
import ThemeToggle from "./_components/ThemeToggle";

const MENU_BASE_URL =
  process.env.NEXT_PUBLIC_MENU_BASE_URL ?? "https://snapdesk-tan.vercel.app";

export default async function AdminPage() {
  const { user, isAdmin, roles } = await getAdmin();

  if (!isAdmin) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center transition-colors duration-200">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="size-16 rounded-full bg-danger-bg border border-danger/20 text-danger flex items-center justify-center mb-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="size-8"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286Zm0 13.036h.008v.008H12v-.008Z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
        <p className="max-w-md text-sm text-muted leading-relaxed">
          The account <strong className="text-foreground">{user.email}</strong> does not have administrator privileges.
          Please contact system support or insert this account into the <code className="rounded bg-muted-bg px-1.5 py-0.5 font-mono text-xs text-foreground font-semibold">admin_users</code> table.
        </p>
        <form action={logout}>
          <button className="mt-4 rounded-xl border border-border bg-card hover:bg-muted-bg px-6 py-2.5 text-sm font-semibold text-foreground shadow-sm hover:shadow transition-all cursor-pointer">
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

  // §0.6 Duplicate-application flag: a pending application whose WhatsApp or
  // owner phone matches ANOTHER business (same person applying twice / with
  // many emails) gets a ⚠️ in the queue.
  const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "").slice(-10);
  for (const p of rows.filter((b) => b.status === "pending")) {
    const pPhones = new Set([digits(p.whatsapp_number), digits(p.owner_phone)].filter(Boolean));
    const match = rows.find(
      (o) =>
        o.id !== p.id &&
        (pPhones.has(digits(o.whatsapp_number)) || pPhones.has(digits(o.owner_phone)))
    );
    if (match) p.dup_warning = match.name;
  }

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
    <main className="min-h-screen bg-background text-foreground transition-colors duration-200 pb-16">
      {/* Premium Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-card/85 backdrop-blur-md">
        <div className="flex w-full items-center justify-between px-6 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            {/* App Icon */}
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
                className="size-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">Snapdesk Admin</h1>
              <p className="text-[10px] font-semibold text-muted tracking-wide uppercase">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {canAssignRoles(roles) && (
              <Link
                href="/team"
                className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold text-foreground hover:bg-muted-bg hover:border-muted/50 shadow-sm transition-all"
              >
                Team
              </Link>
            )}
            <Link
              href="/pages"
              className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold text-foreground hover:bg-muted-bg hover:border-muted/50 shadow-sm transition-all"
            >
              Pages
            </Link>
            <Link
              href="/audit"
              className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold text-foreground hover:bg-muted-bg hover:border-muted/50 shadow-sm transition-all"
            >
              Audit Log
            </Link>
            <ThemeToggle />
            <form action={logout}>
              <button className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold text-danger hover:bg-danger-bg hover:border-danger/30 shadow-sm transition-all cursor-pointer">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="flex w-full flex-col gap-8 px-6 py-8 lg:px-8">
        {error && (
          <div className="flex items-center gap-3 rounded-xl bg-danger-bg border border-danger/20 px-4 py-3 text-sm text-danger animate-fade-in">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="size-5 shrink-0"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
              />
            </svg>
            <p className="font-semibold">Failed to load businesses: {error.message}</p>
          </div>
        )}

        {/* Platform stats Grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Stat
            label="Pending"
            value={pending.length}
            type="warning"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="size-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            }
          />
          <Stat
            label="Approved"
            value={approved.length}
            type="success"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="size-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            }
          />
          <Stat
            label="Suspended"
            value={suspended.length}
            type="danger"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="size-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            }
          />
          <Stat
            label="Orders Today"
            value={ordersToday}
            type="info"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="size-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
              </svg>
            }
          />
          <Stat
            label="Bills Today"
            value={billsToday}
            type="success"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="size-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            }
          />
          <Stat
            label="Revenue (Month)"
            value={money(revenueThisMonth)}
            type="primary"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="size-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 8.25H9m6 3H9m3 6-3-3h1.5a3 3 0 1 0 0-6M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            }
          />
        </div>

        {/* Analytical Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Revenue — Last 30 Days" icon={
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="size-4 text-success">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
            </svg>
          }>
            <MiniBars data={revenueSeries} format={(v) => money(v)} gradientFrom="#10b981" gradientTo="#059669" />
          </ChartCard>
          <ChartCard title="Orders — Last 30 Days" icon={
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="size-4 text-primary">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
            </svg>
          }>
            <MiniBars data={ordersSeries} gradientFrom="#6366f1" gradientTo="#4f46e5" />
          </ChartCard>
        </div>

        {/* Top Businesses + Churn risk */}
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard title="Top Businesses — Revenue This Month" icon={
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-4 text-warning">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 11.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5-1.5.67-1.5 1.5.67 1.5 1.5 1.5z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.477 12.89 17 21l-5-2.83L7 21l1.523-8.11a5.48 5.48 0 0 1-.867-2.25A5.5 5.5 0 0 1 12 4.5c2.5 0 4.6 1.7 5.178 4.095a5.48 5.48 0 0 1-.701 4.295z" />
            </svg>
          }>
            {topBusinesses.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted">No revenue records found.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {topBusinesses.map((b, idx) => (
                  <li key={b.id} className="flex items-center justify-between py-3 hover:bg-muted-bg/30 px-2 rounded-lg transition-colors group">
                    <div className="flex items-center gap-3">
                      <span className="flex size-5 items-center justify-center rounded-full bg-muted-bg text-[10px] font-bold text-muted group-hover:bg-primary/10 group-hover:text-primary">
                        {idx + 1}
                      </span>
                      <Link href={`/business/${b.id}`} className="text-sm font-semibold text-foreground hover:text-primary transition-colors hover:underline truncate max-w-[200px] sm:max-w-xs">
                        {b.name}
                      </Link>
                    </div>
                    <span className="text-sm font-bold tabular-nums text-foreground">{money(b.rev)}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title={`Needs Attention — No Scans 14 Days (${churnRisk.length})`}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-4 text-danger">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286Zm0 13.036h.008v.008H12v-.008Z" />
              </svg>
            }
          >
            {churnRisk.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted">
                All approved businesses have scanned within the last 14 days.
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {churnRisk.slice(0, 10).map((b) => (
                  <li key={b.id} className="flex items-center justify-between py-3 hover:bg-muted-bg/30 px-2 rounded-lg transition-colors">
                    <Link href={`/business/${b.id}`} className="text-sm font-semibold text-foreground hover:text-danger transition-colors hover:underline truncate max-w-[240px] sm:max-w-xs">
                      {b.name}
                    </Link>
                    <span className="inline-flex items-center gap-1 rounded-full bg-danger-bg px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-danger">
                      <span className="size-1.5 rounded-full bg-danger animate-pulse" />
                      Churn Risk
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        {/* Business Status tabs & interactive table */}
        <div className="mt-4">
          <BusinessList businesses={rows} menuBaseUrl={MENU_BASE_URL} />
        </div>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  type,
  icon,
}: {
  label: string;
  value: number | string;
  type: "warning" | "success" | "danger" | "info" | "primary";
  icon: React.ReactNode;
}) {
  const typeClasses = {
    warning: {
      border: "border-warning/20 dark:border-warning/10",
      bg: "bg-warning-bg/40",
      text: "text-warning",
    },
    success: {
      border: "border-success/20 dark:border-success/10",
      bg: "bg-success-bg/40",
      text: "text-success",
    },
    danger: {
      border: "border-danger/20 dark:border-danger/10",
      bg: "bg-danger-bg/40",
      text: "text-danger",
    },
    info: {
      border: "border-info/20 dark:border-info/10",
      bg: "bg-info-bg/40",
      text: "text-info",
    },
    primary: {
      border: "border-primary/20 dark:border-primary/10",
      bg: "bg-primary/5 dark:bg-primary/10",
      text: "text-primary",
    },
  };

  const style = typeClasses[type];

  return (
    <div className={`rounded-2xl border border-border bg-card p-5 shadow-sm hover:shadow-md hover:border-muted/50 transition-all group`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted group-hover:text-foreground transition-colors">
          {label}
        </p>
        <div className={`p-1.5 rounded-lg border ${style.border} ${style.bg} ${style.text}`}>
          {icon}
        </div>
      </div>
      <p className="mt-3 text-2xl font-extrabold tracking-tight text-foreground">
        {value}
      </p>
    </div>
  );
}

function ChartCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}
