"use client";

import { useMemo, useState } from "react";
import { Download, Info } from "lucide-react";
import { formatMoney } from "@/lib/money";
import type { Bill, Order } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type StatusFilter = "all" | Order["status"];

// Minimal RFC-4180-ish CSV: quote every field, double internal quotes.
function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const STATUS_STYLES: Record<Order["status"], string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  approved: "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
  rejected: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  billed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
};

export default function OrdersView({
  currency,
  orders,
  bills,
}: {
  currency: string;
  orders: Order[];
  bills: Bill[];
}) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (status !== "all" && o.status !== status) return false;
      if (!query) return true;
      return (
        o.short_id.toLowerCase().includes(query) ||
        (o.table_no ?? "").toLowerCase().includes(query)
      );
    });
  }, [orders, status, q]);

  const itemsText = (o: Order) => o.items.map((i) => `${i.qty}× ${i.name}`).join(", ");

  const exportOrders = () =>
    downloadCsv("orders.csv", [
      ["Order ID", "Date", "Table", "Source", "Items", "Total", "Status"],
      ...filtered.map((o) => [
        o.short_id,
        new Date(o.created_at).toLocaleString(),
        o.table_no ?? "Counter",
        o.source,
        itemsText(o),
        Number(o.total),
        o.status,
      ]),
    ]);

  const exportBills = () =>
    downloadCsv("bills.csv", [
      ["Bill No", "Date", "Table", "Total", "Void", "Void reason"],
      ...bills.map((b) => [
        b.bill_no,
        new Date(b.created_at).toLocaleString(),
        b.table_no ?? "Counter",
        Number(b.total),
        b.is_void ? "yes" : "no",
        b.void_reason ?? "",
      ]),
    ]);

  const filters: StatusFilter[] = ["all", "pending", "approved", "rejected", "billed"];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
          <p className="text-sm text-muted-foreground">
            Full history of orders and bills.
          </p>
        </div>
      </div>

      {/* 6.4 authoritative-record banner */}
      <div className="flex items-start gap-2 rounded-lg border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          Customers can edit the WhatsApp message text. <strong>This list is
          the real order</strong> — match the Order ID (e.g. <span className="font-mono">#A4X9</span>)
          from the message.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setStatus(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                status === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search order ID or table…"
          className="h-9 max-w-xs"
        />
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={exportOrders}>
            <Download className="mr-1 size-4" /> Orders CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportBills}>
            <Download className="mr-1 size-4" /> Bills CSV
          </Button>
        </div>
      </div>

      {/* Orders table */}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Order</th>
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">Table</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Items</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  No orders match.
                </td>
              </tr>
            ) : (
              filtered.map((o) => (
                <tr key={o.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2 font-mono font-semibold">#{o.short_id}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(o.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">{o.table_no ?? "Counter"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{o.source}</td>
                  <td className="px-3 py-2 text-muted-foreground max-w-xs truncate" title={itemsText(o)}>
                    {itemsText(o)}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                    {formatMoney(currency, Number(o.total))}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[o.status]}`}>
                      {o.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Bills sub-list */}
      <div>
        <h2 className="mb-2 text-sm font-bold">Bills ({bills.length})</h2>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Bill</th>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Table</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {bills.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                    No bills yet.
                  </td>
                </tr>
              ) : (
                bills.map((b) => (
                  <tr key={b.id} className={`hover:bg-muted/20 ${b.is_void ? "opacity-50" : ""}`}>
                    <td className="px-3 py-2 font-mono font-semibold">
                      #{b.bill_no}
                      {b.is_void && <span className="ml-1 text-xs text-destructive">VOID</span>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {new Date(b.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">{b.table_no ?? "Counter"}</td>
                    <td className={`px-3 py-2 text-right font-semibold tabular-nums ${b.is_void ? "line-through" : ""}`}>
                      {formatMoney(currency, Number(b.total))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
