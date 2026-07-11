"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import QRCode from "qrcode";
import {
  ArrowLeft,
  ChevronDown,
  Clock,
  Download,
  Eye,
  FileText,
  History,
  Loader2,
  Minus,
  Plus,
  Printer,
  QrCode,
  Receipt,
  Search,
  CheckCircle2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/money";
import type { MenuItem, Order, OrderItemLine } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { clearTable } from "../actions";
import { addStaffItem, editOrderItems, generateBill } from "./actions";

type Props = {
  businessId: string;
  businessSlug?: string;
  businessName?: string;
  businessLogoUrl?: string | null;
  currency: string;
  tableNo: string | null;
  tableLabel: string;
  menuBaseUrl?: string;
  initialOrders: Order[];
  previousOrders?: Order[];
  previousBills?: any[];
  menuItems: MenuItem[];
};

type LineKeyParts = { name: string; portion: string | null; unit_price: number };
const sameLine = (a: LineKeyParts, b: LineKeyParts) =>
  a.name === b.name &&
  (a.portion ?? null) === (b.portion ?? null) &&
  Number(a.unit_price) === Number(b.unit_price);

const lineTotal = (items: OrderItemLine[]) =>
  Math.round(items.reduce((s, l) => s + Number(l.unit_price) * l.qty, 0) * 100) /
  100;

function minutesAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const h = Math.floor(mins / 60);
  return `${h} hr${h === 1 ? "" : "s"} ago`;
}

type MergedLine = {
  key: string;
  name: string;
  portion: string | null;
  unit_price: number;
  qty: number;
  contributors: string[]; // order ids that carry this line, oldest → newest
};

function ordersSignature(orders: Order[]): string {
  return orders
    .map(
      (o) =>
        `${o.id}:${o.status}:${o.total}:${o.items
          .map((i) => `${i.name}|${i.qty}|${i.line_total}`)
          .join(",")}`
    )
    .join("|");
}

export default function TableDetail({
  businessId,
  businessSlug,
  businessName,
  businessLogoUrl,
  currency,
  tableNo,
  tableLabel,
  menuBaseUrl,
  initialOrders,
  previousOrders = [],
  previousBills = [],
  menuItems,
}: Props) {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [billing, setBilling] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearReason, setClearReason] = useState("");
  const [clearing, setClearing] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // QR Code State
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const url = `${menuBaseUrl || "http://localhost:3000"}/m/${businessSlug || ""}${
      tableNo ? `?table=${encodeURIComponent(tableNo)}` : ""
    }`;
    QRCode.toDataURL(url, { width: 320, margin: 1 })
      .then((res) => {
        if (mounted) setQrDataUrl(res);
      })
      .catch((e) => console.error("QR gen failed:", e));
    return () => {
      mounted = false;
    };
  }, [menuBaseUrl, businessSlug, tableNo]);

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `${tableLabel.replace(/\s+/g, "_")}_QR.png`;
    link.click();
  };

  // In-Place Bill Modal State
  const [billModalOpen, setBillModalOpen] = useState(false);
  const [generatedBillData, setGeneratedBillData] = useState<{
    id: string;
    items: MergedLine[];
    total: number;
    created_at: string;
  } | null>(null);

  // Previous Order Detail Modal State
  const [selectedHistoryOrder, setSelectedHistoryOrder] = useState<Order | null>(null);

  const initialSigRef = useRef(ordersSignature(initialOrders));
  useEffect(() => {
    const sig = ordersSignature(initialOrders);
    if (initialSigRef.current !== sig) {
      initialSigRef.current = sig;
      setOrders(initialOrders);
    }
  }, [initialOrders]);

  // Realtime: keep this table live
  const matchesTable = useCallback(
    (t: string | null) => (t ?? null) === (tableNo ?? null),
    [tableNo]
  );

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`table-${businessId}-${tableNo ?? "counter"}`).on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "orders",
        filter: `business_id=eq.${businessId}`,
      },
      (payload) => {
        const row = (payload.new || payload.old) as Order | undefined;
        if (!row || !matchesTable(row.table_no)) return;
        router.refresh();
      }
    );
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId, tableNo, matchesTable, router]);

  const merged = useMemo<MergedLine[]>(() => {
    const map = new Map<string, MergedLine>();
    for (const o of orders) {
      for (const line of o.items) {
        const k = `${line.name}__${line.portion ?? ""}__${line.unit_price}`;
        const ex = map.get(k);
        if (ex) {
          ex.qty += line.qty;
          ex.contributors.push(o.id);
        } else {
          map.set(k, {
            key: k,
            name: line.name,
            portion: line.portion ?? null,
            unit_price: Number(line.unit_price),
            qty: line.qty,
            contributors: [o.id],
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [orders]);

  const runningTotal = useMemo(
    () =>
      Math.round(
        merged.reduce((s, m) => s + m.unit_price * m.qty, 0) * 100
      ) / 100,
    [merged]
  );

  const firstOrderTime = useMemo(() => {
    if (orders.length === 0) return null;
    return orders[0].created_at;
  }, [orders]);

  // Adjust item qty across unbilled orders
  const bump = async (line: MergedLine, delta: number) => {
    setBusyKey(line.key);
    const order = orders.find((o) => o.id === line.contributors[0]);
    if (!order) {
      setBusyKey(null);
      return;
    }

    const currentQty =
      order.items.find((i) =>
        sameLine(i, {
          name: line.name,
          portion: line.portion,
          unit_price: line.unit_price,
        })
      )?.qty ?? 0;
    const nextQty = currentQty + delta;

    let updatedItems: OrderItemLine[];
    if (nextQty <= 0) {
      updatedItems = order.items.filter(
        (i) =>
          !sameLine(i, {
            name: line.name,
            portion: line.portion,
            unit_price: line.unit_price,
          })
      );
    } else {
      updatedItems = order.items.map((i) =>
        sameLine(i, {
          name: line.name,
          portion: line.portion,
          unit_price: line.unit_price,
        })
          ? {
              ...i,
              qty: nextQty,
              line_total: Math.round(Number(i.unit_price) * nextQty * 100) / 100,
            }
          : i
      );
    }

    setOrders((prev) =>
      prev.map((o) =>
        o.id === order.id
          ? {
              ...o,
              items: updatedItems,
              total: lineTotal(updatedItems),
            }
          : o
      )
    );

    const res = await editOrderItems(order.id, updatedItems);
    setBusyKey(null);
    if (!res.ok) {
      toast.error(res.error);
      router.refresh();
    }
  };

  const removeLine = async (line: MergedLine) => {
    setBusyKey(line.key);
    const order = orders.find((o) => o.id === line.contributors[0]);
    if (!order) {
      setBusyKey(null);
      return;
    }

    const updatedItems = order.items.filter(
      (i) =>
        !sameLine(i, {
          name: line.name,
          portion: line.portion,
          unit_price: line.unit_price,
        })
    );

    setOrders((prev) =>
      prev.map((o) =>
        o.id === order.id
          ? {
              ...o,
              items: updatedItems,
              total: lineTotal(updatedItems),
            }
          : o
      )
    );

    const res = await editOrderItems(order.id, updatedItems);
    setBusyKey(null);
    if (!res.ok) {
      toast.error(res.error);
      router.refresh();
    }
  };

  const handleAddItem = async (item: MenuItem, portionLabel: string | null) => {
    const unit_price =
      portionLabel === "Half" && item.price_half !== null
        ? item.price_half
        : item.price_full;
    const line: OrderItemLine = {
      item_id: item.id,
      name: item.name,
      portion: portionLabel,
      qty: 1,
      unit_price,
      line_total: unit_price,
    };
    setAddOpen(false);
    setQuery("");
    const res = await addStaffItem(tableNo, line);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Added ${item.name}`);
    router.refresh();
  };

  const handleClearTable = async () => {
    if (clearing) return;
    setClearing(true);
    const res = await clearTable(tableNo, clearReason);
    setClearing(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Table cleared — no bill generated");
    router.push("/dashboard/tables");
  };

  // Generate bill in-place without navigating away
  const handleGenerateBill = async () => {
    if (billing) return;
    setBilling(true);
    const snapItems = [...merged];
    const snapTotal = runningTotal;
    const res = await generateBill(tableNo);
    setBilling(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Bill generated successfully!");
    setGeneratedBillData({
      id: res.billId,
      items: snapItems,
      total: snapTotal,
      created_at: new Date().toISOString(),
    });
    setBillModalOpen(true);
  };

  const filteredMenu = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return menuItems;
    return menuItems.filter((m) => m.name.toLowerCase().includes(q));
  }, [menuItems, query]);

  const hasItems = merged.length > 0;

  return (
    <div className="flex w-full flex-col gap-6 pb-16">
      {/* Header Card */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="rounded-xl shadow-xs" asChild>
            <Link href="/dashboard/tables" aria-label="Back to tables">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{tableLabel}</h1>
            {firstOrderTime ? (
              <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <span className="inline-block size-2 rounded-full bg-emerald-500 animate-pulse" />
                Open since {minutesAgo(firstOrderTime)}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Ready for new orders</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
          <div className="rounded-xl bg-emerald-50 px-4 py-2 text-right border border-emerald-200/60 dark:bg-emerald-950/30 dark:border-emerald-800/50">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Running Bill</p>
            <p className="text-2xl font-extrabold tabular-nums text-emerald-800 dark:text-emerald-200">
              {formatMoney(currency, runningTotal)}
            </p>
          </div>
        </div>
      </div>

      {/* Main Responsive 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left / Main Column (Current Running Order - Always Top) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
            <div className="border-b bg-muted/40 px-5 py-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Current Table Bill · Ordered Items
              </span>
              <span className="text-xs font-semibold text-muted-foreground">
                {merged.length} line{merged.length === 1 ? "" : "s"}
              </span>
            </div>
            {!hasItems ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <Receipt className="mb-3 size-10 text-muted-foreground/40" />
                <p className="text-sm font-medium text-foreground">No active orders on this table yet</p>
                <p className="mt-1 text-xs text-muted-foreground">Add items below to build the current table bill.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border/50">
                {merged.map((line) => (
                  <li key={line.key} className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/30">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {line.name}
                        {line.portion && (
                          <span className="ml-1.5 rounded-md bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
                            {line.portion}
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatMoney(currency, line.unit_price)} each
                      </p>
                    </div>
                    <div className="flex items-center rounded-xl border bg-background shadow-2xs">
                      <button
                        onClick={() => bump(line, -1)}
                        disabled={busyKey === line.key}
                        aria-label="Decrease"
                        className="px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="min-w-8 text-center text-sm font-bold tabular-nums">
                        {busyKey === line.key ? (
                          <Loader2 className="mx-auto size-3.5 animate-spin" />
                        ) : (
                          line.qty
                        )}
                      </span>
                      <button
                        onClick={() => bump(line, 1)}
                        disabled={busyKey === line.key}
                        aria-label="Increase"
                        className="px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    <span className="w-20 text-right text-sm font-bold tabular-nums text-foreground">
                      {formatMoney(currency, line.unit_price * line.qty)}
                    </span>
                    <button
                      onClick={() => removeLine(line)}
                      disabled={busyKey === line.key}
                      className="rounded-lg p-1.5 text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                      title="Remove line"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t bg-muted/20 p-4">
              <Button variant="outline" className="w-full rounded-xl font-semibold shadow-xs" onClick={() => setAddOpen(true)}>
                <Plus className="mr-1.5 size-4" /> Add item to table
              </Button>
            </div>
          </div>

          {/* Current Bill Status & In-Place Actions */}
          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Current Bill Status</h3>
                <p className="text-xs text-muted-foreground">Generate and print bill in-place</p>
              </div>
              <Badge variant={hasItems ? "default" : "secondary"} className="text-xs font-semibold">
                {hasItems ? "Unbilled · Active" : "Empty Table"}
              </Badge>
            </div>

            <Button
              size="lg"
              className="w-full rounded-2xl h-14 text-base font-bold shadow-md bg-emerald-600 hover:bg-emerald-700 text-white transition-all"
              disabled={!hasItems || billing}
              onClick={handleGenerateBill}
            >
              {billing ? (
                <Loader2 className="mr-2 size-5 animate-spin" />
              ) : (
                <Receipt className="mr-2 size-5" />
              )}
              Generate Bill & Print · {formatMoney(currency, runningTotal)}
            </Button>

            {hasItems && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive rounded-xl"
                disabled={billing}
                onClick={() => setClearOpen(true)}
              >
                Clear table without bill
              </Button>
            )}
          </div>
        </div>

        {/* Right Column: Top QR Code + Previous Orders History */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* Top-Right QR Code Card */}
          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm flex flex-col items-center text-center gap-3">
            <div className="flex items-center justify-between w-full border-b pb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <QrCode className="size-4 text-emerald-600" /> Table QR Code
              </span>
              <Badge variant="outline" className="text-[10px] font-medium">Customer Scan</Badge>
            </div>
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`${tableLabel} QR Code`}
                className="size-40 rounded-xl border bg-white p-2 shadow-xs"
              />
            ) : (
              <div className="size-40 rounded-xl border border-dashed flex items-center justify-center bg-muted/20">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Customers scan to open this table&apos;s menu
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full rounded-xl font-semibold shadow-xs mt-1"
              onClick={handleDownloadQr}
              disabled={!qrDataUrl}
            >
              <Download className="mr-1.5 size-4 text-emerald-600" /> Download QR Image
            </Button>
          </div>

          {/* Previous Orders & Bills Panel */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden flex flex-col">
            <div className="border-b bg-muted/40 px-5 py-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <History className="size-4 text-emerald-600" /> Previous Orders & Bills
              </span>
              <span className="text-xs font-semibold text-muted-foreground">
                {previousOrders.length}
              </span>
            </div>

            <div className="max-h-[460px] overflow-y-auto divide-y divide-border/50">
              {previousOrders.length === 0 ? (
                <div className="p-8 text-center">
                  <FileText className="mx-auto mb-2 size-8 text-muted-foreground/40" />
                  <p className="text-xs font-medium text-foreground">No previous orders found</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Past orders will show up here</p>
                </div>
              ) : (
                previousOrders.map((o) => {
                  const isPaidOrBilled = o.status === "billed" || o.bill_id !== null;
                  return (
                    <button
                      key={o.id}
                      onClick={() => setSelectedHistoryOrder(o)}
                      className="w-full flex items-center justify-between p-3.5 text-left transition-colors hover:bg-muted/30"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground">
                            #{o.short_id}
                          </span>
                          <Badge
                            variant="secondary"
                            className={`text-[10px] px-1.5 py-0 ${
                              isPaidOrBilled
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            }`}
                          >
                            {isPaidOrBilled ? "Billed · Paid" : o.status}
                          </Badge>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock className="size-3" /> {minutesAgo(o.created_at)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold tabular-nums text-foreground">
                          {formatMoney(currency, Number(o.total))}
                        </p>
                        <span className="text-[11px] text-emerald-600 font-medium flex items-center justify-end gap-0.5 mt-0.5">
                          Details <Eye className="size-3" />
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add item Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add item to {tableLabel}</DialogTitle>
          </DialogHeader>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search items..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <ul className="mt-2 divide-y">
            {filteredMenu.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.has_portions
                      ? `Full: ${formatMoney(currency, item.price_full)} · Half: ${
                          item.price_half ? formatMoney(currency, item.price_half) : "—"
                        }`
                      : formatMoney(currency, item.price_full)}
                  </p>
                </div>
                <div className="flex gap-2">
                  {item.has_portions ? (
                    <>
                      {item.price_half !== null && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAddItem(item, "Half")}
                        >
                          + Half
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddItem(item, "Full")}
                      >
                        + Full
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddItem(item, null)}
                    >
                      + Add
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      {/* Clear-table reason dialog */}
      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Clear {tableLabel} without a bill?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Use this for walk-outs or test items. No revenue will be recorded.
          </p>
          <Input
            autoFocus
            placeholder="Reason (optional)"
            value={clearReason}
            onChange={(e) => setClearReason(e.target.value)}
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setClearOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={clearing}
              onClick={handleClearTable}
            >
              {clearing ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : (
                "Clear table"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* In-Place Generated Bill & Print Popup Dialog */}
      <Dialog
        open={billModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setBillModalOpen(false);
            router.refresh();
          }
        }}
      >
        <DialogContent className="max-w-md p-6">
          <style>{`
            @media print {
              @page { size: 80mm auto; margin: 4mm; }
              body * { visibility: hidden; }
              #in-place-receipt, #in-place-receipt * { visibility: visible; }
              #in-place-receipt {
                position: absolute; left: 0; top: 0; width: 72mm;
                font-family: ui-monospace, monospace; color: #000;
              }
              .no-print { display: none !important; }
            }
          `}</style>

          <DialogHeader className="no-print">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-emerald-600">
              <CheckCircle2 className="size-5" /> Bill Generated Successfully
            </DialogTitle>
          </DialogHeader>

          {/* Receipt Preview Body */}
          {generatedBillData && (
            <div
              id="in-place-receipt"
              className="rounded-xl border bg-white p-5 text-sm text-black shadow-xs"
            >
              <div className="text-center border-b pb-3 mb-3">
                <p className="font-bold text-base">{businessName || "Business Bill"}</p>
                <p className="text-xs text-zinc-600">{tableLabel}</p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  {new Date(generatedBillData.created_at).toLocaleString()}
                </p>
              </div>

              <ul className="divide-y divide-zinc-200/60 text-xs mb-3">
                {generatedBillData.items.map((m) => (
                  <li key={m.key} className="py-2 flex justify-between">
                    <span>
                      {m.qty}× {m.name} {m.portion ? `(${m.portion})` : ""}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {formatMoney(currency, m.unit_price * m.qty)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="border-t pt-2 flex justify-between font-bold text-sm">
                <span>TOTAL</span>
                <span className="tabular-nums">
                  {formatMoney(currency, generatedBillData.total)}
                </span>
              </div>
            </div>
          )}

          <div className="no-print flex justify-end gap-3 mt-4">
            <Button
              variant="outline"
              className="rounded-xl font-medium"
              onClick={() => {
                setBillModalOpen(false);
                router.refresh();
              }}
            >
              Done & Close
            </Button>
            <Button
              className="rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
              onClick={() => window.print()}
            >
              <Printer className="mr-1.5 size-4" /> Print Thermal Receipt
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Previous Order Details Modal */}
      <Dialog
        open={selectedHistoryOrder !== null}
        onOpenChange={(open) => !open && setSelectedHistoryOrder(null)}
      >
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Order #{selectedHistoryOrder?.short_id}</span>
              <Badge
                variant="secondary"
                className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
              >
                {selectedHistoryOrder?.status === "billed" ||
                selectedHistoryOrder?.bill_id
                  ? "Billed · Paid"
                  : selectedHistoryOrder?.status}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {selectedHistoryOrder && (
            <div className="flex flex-col gap-4 mt-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground border-b pb-2">
                <span>Date & Time</span>
                <span>{new Date(selectedHistoryOrder.created_at).toLocaleString()}</span>
              </div>

              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Items Ordered
                </span>
                <ul className="mt-2 divide-y divide-border/50 rounded-xl border p-3 bg-muted/20">
                  {selectedHistoryOrder.items?.map((item, idx) => (
                    <li key={idx} className="py-2 flex items-center justify-between text-sm">
                      <div>
                        <span className="font-semibold text-foreground">
                          {item.qty}× {item.name}
                        </span>
                        {item.portion && (
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            ({item.portion})
                          </span>
                        )}
                      </div>
                      <span className="font-bold tabular-nums text-foreground">
                        {formatMoney(currency, Number(item.line_total || item.unit_price * item.qty))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center justify-between border-t pt-3 font-bold text-base text-foreground">
                <span>Total Amount</span>
                <span className="tabular-nums text-emerald-600">
                  {formatMoney(currency, Number(selectedHistoryOrder.total))}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
