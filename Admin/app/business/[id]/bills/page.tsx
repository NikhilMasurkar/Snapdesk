import { createServiceClient } from "@/lib/service";
import { money, timeWindows, dailySeries } from "@/lib/analytics";
import type { Bill } from "@/lib/types";
import MiniBars from "../../../_components/MiniBars";

// ponytail: last 60 days covers this + last month (stats) and the 30d chart;
// add pagination / an "all time" toggle only if a business needs deeper history.
export default async function BillsTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { som, spm, days30, days60 } = timeWindows();

  const { data } = await createServiceClient()
    .from("bills")
    .select("*")
    .eq("business_id", id)
    .gte("created_at", days60)
    .order("created_at", { ascending: false })
    .limit(200);
  const bills = (data ?? []) as Bill[];

  const paid = bills.filter((b) => !b.is_void);
  const revThisMonth = paid
    .filter((b) => b.created_at >= som)
    .reduce((s, b) => s + Number(b.total), 0);
  const revLastMonth = paid
    .filter((b) => b.created_at >= spm && b.created_at < som)
    .reduce((s, b) => s + Number(b.total), 0);
  const revenueSeries = dailySeries(
    paid.filter((b) => b.created_at >= days30),
    (b) => b.created_at,
    (b) => Number(b.total),
    30
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="Revenue This Month" value={money(revThisMonth)} />
        <Stat label="Revenue Last Month" value={money(revLastMonth)} muted />
        <Stat label="Bills (60d)" value={String(bills.length)} />
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted">
          Revenue — Last 30 Days
        </h2>
        <MiniBars data={revenueSeries} format={(v) => money(v)} gradientFrom="#10b981" gradientTo="#059669" />
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted">
          Billing Log ({bills.length})
        </h2>
        {bills.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted">No invoices in the last 60 days.</p>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted">
                  <th className="pb-3 pr-4">Bill No</th>
                  <th className="pb-3 px-4">Table</th>
                  <th className="pb-3 px-4 text-right">Invoice Total</th>
                  <th className="pb-3 pl-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {bills.map((b) => (
                  <tr key={b.id} className={`hover:bg-muted-bg/30 transition-colors ${b.is_void ? "opacity-45" : ""}`}>
                    <td className="py-3 pr-4 font-mono font-bold text-foreground">
                      #{b.bill_no}
                      {b.is_void && (
                        <span className="ml-2 inline-flex items-center rounded bg-danger-bg px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-danger">
                          Void
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-semibold text-foreground">{b.table_no ?? "Counter"}</td>
                    <td className={`py-3 px-4 text-right font-extrabold tabular-nums ${b.is_void ? "text-danger line-through" : "text-foreground"}`}>
                      {money(Number(b.total))}
                    </td>
                    <td className="py-3 pl-4 text-muted">{new Date(b.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-3 text-2xl font-extrabold tracking-tight ${muted ? "text-muted" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}
