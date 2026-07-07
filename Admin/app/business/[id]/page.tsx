import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/service";
import { money, dailySeries, timeWindows } from "@/lib/analytics";
import type { Bill, Business, BusinessFeatures, Order, Testimonial } from "@/lib/types";
import MiniBars from "../../_components/MiniBars";
import BusinessAdmin from "./BusinessAdmin";
import QrPackButton from "./QrPackButton";

const MENU_BASE_URL =
  process.env.NEXT_PUBLIC_MENU_BASE_URL ?? "https://snapdesk-tan.vercel.app";

export default async function BusinessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { isAdmin } = await getAdmin();
  if (!isAdmin) notFound(); // don't reveal the panel exists

  const service = createServiceClient();
  const { data: bizData } = await service
    .from("businesses")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!bizData) notFound();
  const business = bizData as Business;
  const windows = timeWindows();

  const [featRes, ordersRes, billsRes, testiRes, scansRes] = await Promise.all([
    service.from("business_features").select("*").eq("business_id", id).maybeSingle(),
    service
      .from("orders")
      .select("*")
      .eq("business_id", id)
      .order("created_at", { ascending: false })
      .limit(300),
    service
      .from("bills")
      .select("*")
      .eq("business_id", id)
      .order("created_at", { ascending: false })
      .limit(300),
    service
      .from("testimonials")
      .select("*")
      .eq("business_id", id)
      .order("created_at", { ascending: false }),
    service
      .from("scan_events")
      .select("table_no, created_at")
      .eq("business_id", id)
      .gte("created_at", windows.days30),
  ]);

  const features =
    (featRes.data as BusinessFeatures) ?? {
      business_id: id,
      ordering_enabled: true,
      testimonials_enabled: true,
      photos_enabled: true,
      analytics_enabled: false,
      tables_enabled: true,
      max_menu_items: 30,
    };
  const orders = (ordersRes.data ?? []) as Order[];
  const bills = (billsRes.data ?? []) as Bill[];
  const testimonials = (testiRes.data ?? []) as Testimonial[];
  const scans = (scansRes.data ?? []) as { table_no: string | null; created_at: string }[];

  let ownerEmail: string | undefined;
  if (business.owner_id) {
    const { data } = await service.auth.admin.getUserById(business.owner_id);
    ownerEmail = data.user?.email ?? undefined;
  }

  // Revenue = non-void bills. Month windows.
  const { som, spm } = windows;
  const paid = bills.filter((b) => !b.is_void);
  const revThisMonth = paid
    .filter((b) => b.created_at >= som)
    .reduce((s, b) => s + Number(b.total), 0);
  const revLastMonth = paid
    .filter((b) => b.created_at >= spm && b.created_at < som)
    .reduce((s, b) => s + Number(b.total), 0);
  const ordersThisMonth = orders.filter((o) => o.created_at >= som).length;

  const revenueSeries = dailySeries(paid, (b) => b.created_at, (b) => Number(b.total), 30);

  // Scans per table (30d).
  const scanByTable = new Map<string, number>();
  for (const s of scans) {
    const k = s.table_no ?? "Counter";
    scanByTable.set(k, (scanByTable.get(k) ?? 0) + 1);
  }
  const topTables = [...scanByTable.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  business.owner_email = ownerEmail;

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-zinc-500 hover:text-white">
              ← Admin
            </Link>
            <div>
              <h1 className="text-base font-bold tracking-tight">{business.name}</h1>
              <p className="text-xs text-zinc-500">
                {business.status} · {business.plan} ·{" "}
                <a
                  href={`${MENU_BASE_URL}/m/${business.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-white"
                >
                  /m/{business.slug}
                </a>
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Revenue this month" value={money(revThisMonth)} />
          <Stat label="Revenue last month" value={money(revLastMonth)} muted />
          <Stat label="Orders this month" value={String(ordersThisMonth)} />
          <Stat label="Scans (30d)" value={String(scans.length)} />
        </div>

        {/* Revenue chart */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-400">
            Revenue — last 30 days
          </h2>
          <MiniBars data={revenueSeries} format={(v) => money(v)} />
        </section>

        {/* QR pack (admin-only) */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-400">
            QR codes — {business.table_count} tables + Counter
          </h2>
          <p className="mb-3 text-xs text-zinc-500">
            Deterministic QRs — reprints always match. Owners have no QR access.
          </p>
          <QrPackButton
            slug={business.slug}
            businessName={business.name}
            tableCount={business.table_count}
            menuBaseUrl={MENU_BASE_URL}
          />
        </section>

        {/* Interactive admin controls */}
        <BusinessAdmin
          business={business}
          features={features}
          testimonials={testimonials}
        />

        {/* Scans per table */}
        {topTables.length > 0 && (
          <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-400">
              Scans per table (30d)
            </h2>
            <div className="flex flex-wrap gap-2">
              {topTables.map(([table, count]) => (
                <span
                  key={table}
                  className="rounded-lg bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300"
                >
                  {table === "Counter" ? "Counter" : `Table ${table}`}: {count}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Orders */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-400">
            Recent orders ({orders.length})
          </h2>
          {orders.length === 0 ? (
            <p className="text-sm text-zinc-600">No orders yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-zinc-500">
                  <tr>
                    <th className="pb-2">Order</th>
                    <th className="pb-2">Table</th>
                    <th className="pb-2">Items</th>
                    <th className="pb-2 text-right">Total</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {orders.slice(0, 50).map((o) => (
                    <tr key={o.id}>
                      <td className="py-1.5 font-mono">#{o.short_id}</td>
                      <td className="py-1.5">{o.table_no ?? "Counter"}</td>
                      <td className="py-1.5 text-zinc-400">
                        {o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{money(Number(o.total))}</td>
                      <td className="py-1.5">
                        <StatusChip status={o.status} />
                      </td>
                      <td className="py-1.5 text-zinc-500">
                        {new Date(o.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Bills */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-400">
            Bills ({bills.length})
          </h2>
          {bills.length === 0 ? (
            <p className="text-sm text-zinc-600">No bills yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-zinc-500">
                  <tr>
                    <th className="pb-2">Bill</th>
                    <th className="pb-2">Table</th>
                    <th className="pb-2 text-right">Total</th>
                    <th className="pb-2">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {bills.slice(0, 50).map((b) => (
                    <tr key={b.id} className={b.is_void ? "opacity-50" : ""}>
                      <td className="py-1.5">
                        #{b.bill_no}
                        {b.is_void && (
                          <span className="ml-1 text-red-500">VOID</span>
                        )}
                      </td>
                      <td className="py-1.5">{b.table_no ?? "Counter"}</td>
                      <td className="py-1.5 text-right tabular-nums">
                        {money(Number(b.total))}
                      </td>
                      <td className="py-1.5 text-zinc-500">
                        {new Date(b.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className={`mt-1 text-xl font-extrabold ${muted ? "text-zinc-500" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const cls =
    status === "billed"
      ? "bg-emerald-950 text-emerald-400"
      : status === "approved"
        ? "bg-sky-950 text-sky-400"
        : status === "pending"
          ? "bg-amber-950 text-amber-400"
          : "bg-zinc-800 text-zinc-500";
  return <span className={`rounded px-1.5 py-0.5 ${cls}`}>{status}</span>;
}
