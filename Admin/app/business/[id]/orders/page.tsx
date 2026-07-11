import { createServiceClient } from "@/lib/service";
import { money } from "@/lib/analytics";
import type { Order } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// ponytail: shows the most recent 50; add pagination when a business needs it.
export default async function OrdersTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, count } = await createServiceClient()
    .from("orders")
    .select("*", { count: "exact" })
    .eq("business_id", id)
    .order("created_at", { ascending: false })
    .limit(50);
  const orders = (data ?? []) as Order[];

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
          Orders ({count ?? orders.length})
        </h2>
        <span className="text-[10px] text-muted font-bold">Recent 50</span>
      </div>

      {orders.length === 0 ? (
        <p className="py-8 text-center text-xs text-muted">No orders processed yet.</p>
      ) : (
        <div className="overflow-x-auto -mx-5 px-5">
          <Table className="w-full text-left text-xs border-collapse">
            <TableHeader>
              <TableRow className="border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted">
                <TableHead className="pb-3 pr-4">Order ID</TableHead>
                <TableHead className="pb-3 px-4">Table</TableHead>
                <TableHead className="pb-3 px-4">Menu Items</TableHead>
                <TableHead className="pb-3 px-4 text-right">Total Amount</TableHead>
                <TableHead className="pb-3 px-4">Status</TableHead>
                <TableHead className="pb-3 pl-4">Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border/60">
              {orders.map((o) => (
                <TableRow key={o.id} className="hover:bg-muted-bg/30 transition-colors">
                  <TableCell className="py-3 pr-4 font-mono font-bold text-foreground">#{o.short_id}</TableCell>
                  <TableCell className="py-3 px-4 font-semibold text-foreground">{o.table_no ?? "Counter"}</TableCell>
                  <TableCell
                    className="py-3 px-4 text-muted max-w-sm truncate"
                    title={o.items.map((i) => `${i.qty}x ${i.name}`).join(", ")}
                  >
                    {o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
                  </TableCell>
                  <TableCell className="py-3 px-4 text-right font-bold tabular-nums text-foreground">
                    {money(Number(o.total))}
                  </TableCell>
                  <TableCell className="py-3 px-4">
                    <StatusChip status={o.status} />
                  </TableCell>
                  <TableCell className="py-3 pl-4 text-muted" suppressHydrationWarning>
                    {o.created_at ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(o.created_at)) : "N/A"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

function StatusChip({ status }: { status: string }) {
  const cls =
    status === "billed"
      ? "bg-success-bg text-success border-success/20"
      : status === "approved"
        ? "bg-info-bg text-info border-info/20"
        : status === "pending"
          ? "bg-warning-bg text-warning border-warning/20"
          : status === "cancelled"
            ? "bg-danger-bg text-danger border-danger/20"
            : "bg-muted-bg text-muted border-border/80";
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 font-bold uppercase tracking-wide text-[9px] ${cls}`}>
      {status}
    </span>
  );
}
