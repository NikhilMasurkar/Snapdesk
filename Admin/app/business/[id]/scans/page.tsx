import { createServiceClient } from "@/lib/service";
import { timeWindows } from "@/lib/analytics";

export default async function ScansTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { days30 } = timeWindows();
  const { data } = await createServiceClient()
    .from("scan_events")
    .select("table_no, created_at")
    .eq("business_id", id)
    .gte("created_at", days30);
  const scans = (data ?? []) as { table_no: string | null }[];

  const byTable = new Map<string, number>();
  for (const s of scans) {
    const k = s.table_no ?? "Counter";
    byTable.set(k, (byTable.get(k) ?? 0) + 1);
  }
  const sorted = [...byTable.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
          Scan Frequency — Last 30 Days
        </h2>
        <span className="text-sm font-extrabold text-foreground">{scans.length} total</span>
      </div>
      {sorted.length === 0 ? (
        <p className="py-8 text-center text-xs text-muted">No scans in the last 30 days.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {sorted.map(([table, count]) => (
            <span
              key={table}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted-bg/50 px-2.5 py-1 text-xs font-semibold text-foreground"
            >
              <span className="size-1.5 rounded-full bg-primary" />
              {table === "Counter" ? "Counter" : `Table ${table}`}: {count}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
