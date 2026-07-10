"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronDown,
  Clock,
  Loader2,
  Minus,
  Plus,
  Receipt,
  Search,
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
  currency: string;
  tableNo: string | null;
  tableLabel: string;
  initialOrders: Order[];
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

export default function TableDetail({
  businessId,
  currency,
  tableNo,
  tableLabel,
  initialOrders,
  menuItems,
}: Props) {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [billing, setBilling] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearReason, setClearReason] = useState("");
  const [clearing, setClearing] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const initialRef = useRef(initialOrders);
  useEffect(() => {
    if (initialRef.current !== initialOrders) {
      initialRef.current = initialOrders;
      setOrders(initialOrders);
    }
  }, [initialOrders]);

  // ── Realtime: keep this table live (approvals elsewhere, new staff lines) ──
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
        const row = payload.new as Order;
        const isOpen = (o: Order) =>
          o.status === "approved" && o.bill_id === null && matchesTable(o.table_no);
        if (payload.eventType === "DELETE") {
          const old = payload.old as { id: string };
          setOrders((prev) => prev.filter((o) => o.id !== old.id));
          return;
        }
        setOrders((prev) => {
          const without = prev.filter((o) => o.id !== row.id);
          return isOpen(row) ? [...without, row] : without;
        });
      }
    );

    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      channel.subscribe();
    });
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [businessId, tableNo, matchesTable]);

  // ── Derived: merged lines + running total ─────────────────────────────────
  const merged = useMemo<MergedLine[]>(() => {
    const map = new Map<string, MergedLine>();
    for (const o of orders) {
      for (const it of o.items) {
        const key = `${it.name}|${it.portion ?? ""}|${it.unit_price}`;
        const existing = map.get(key);
        if (existing) {
          existing.qty += it.qty;
          existing.contributors.push(o.id);
        } else {
          map.set(key, {
            key,
            name: it.name,
            portion: it.portion ?? null,
            unit_price: Number(it.unit_price),
            qty: it.qty,
            contributors: [o.id],
          });
        }
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [orders]);

  const runningTotal = useMemo(
    () => orders.reduce((s, o) => s + Number(o.total), 0),
    [orders]
  );
  const firstOrderTime = orders.length > 0 ? orders[0].created_at : null;

  // ── Editing: mutate one underlying order, persist, revert on failure ──────
  const mutateOrder = useCallback(
    async (
      orderId: string,
      transform: (items: OrderItemLine[]) => OrderItemLine[]
    ) => {
      const target = orders.find((o) => o.id === orderId);
      if (!target) return;
      const nextItems = transform(target.items);
      const prevOrders = orders;
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, items: nextItems, total: lineTotal(nextItems) }
            : o
        )
      );
      const res = await editOrderItems(orderId, nextItems);
      if (!res.ok) {
        setOrders(prevOrders);
        toast.error(res.error);
      }
    },
    [orders]
  );

  const bump = async (line: MergedLine, delta: 1 | -1) => {
    // Apply to the newest contributing order so edits are deterministic.
    const orderId = line.contributors[line.contributors.length - 1];
    setBusyKey(line.key);
    await mutateOrder(orderId, (items) =>
      items
        .map((it) =>
          sameLine(it, line) ? { ...it, qty: it.qty + delta } : it
        )
        .filter((it) => it.qty > 0)
    );
    setBusyKey(null);
  };

  const removeLine = async (line: MergedLine) => {
    setBusyKey(line.key);
    // Drop the line from every order that carries it.
    for (const orderId of [...new Set(line.contributors)]) {
      await mutateOrder(orderId, (items) =>
        items.filter((it) => !sameLine(it, line))
      );
    }
    setBusyKey(null);
  };

  // ── Add staff item ────────────────────────────────────────────────────────
  const handleAdd = async (item: MenuItem, portion: "half" | "full" | null) => {
    const unit_price =
      portion === "half" ? Number(item.price_half) : Number(item.price_full);
    const line: OrderItemLine = {
      item_id: item.id,
      name: item.name,
      portion,
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

  // ── Generate bill ─────────────────────────────────────────────────────────
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

  const handleGenerateBill = async () => {
    if (billing) return;
    setBilling(true);
    const res = await generateBill(tableNo);
    if (!res.ok) {
      setBilling(false);
      toast.error(res.error);
      return;
    }
    router.push(`/dashboard/bills/${res.billId}?print=1`);
  };

  const filteredMenu = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return menuItems;
    return menuItems.filter((m) => m.name.toLowerCase().includes(q));
  }, [menuItems, query]);

  const hasItems = merged.length > 0;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/tables" aria-label="Back to tables">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{tableLabel}</h1>
          {firstOrderTime && (
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="size-3.5" /> Open since {minutesAgo(firstOrderTime)}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Running total</p>
          <p className="text-2xl font-bold tabular-nums">
            {formatMoney(currency, runningTotal)}
          </p>
        </div>
      </div>

      {/* Item list */}
      <div className="rounded-xl border bg-background">
        {!hasItems ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            No items yet. Add what the customer ordered.
          </p>
        ) : (
          <ul className="divide-y">
            {merged.map((line) => (
              <li key={line.key} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {line.name}
                    {line.portion && (
                      <span className="text-muted-foreground"> · {line.portion}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatMoney(currency, line.unit_price)} each
                  </p>
                </div>
                <div className="flex items-center rounded-lg border">
                  <button
                    onClick={() => bump(line, -1)}
                    disabled={busyKey === line.key}
                    aria-label="Decrease"
                    className="px-2.5 py-1.5 text-muted-foreground hover:text-foreground disabled:opacity-40"
                  >
                    <Minus className="size-4" />
                  </button>
                  <span className="min-w-8 text-center text-sm font-semibold tabular-nums">
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
                    className="px-2.5 py-1.5 text-muted-foreground hover:text-foreground disabled:opacity-40"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
                <span className="w-16 text-right text-sm font-semibold tabular-nums">
                  {formatMoney(currency, line.unit_price * line.qty)}
                </span>
                <button
                  onClick={() => removeLine(line)}
                  disabled={busyKey === line.key}
                  className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-40"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t p-3">
          <Button variant="outline" className="w-full" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1 size-4" /> Add item
          </Button>
        </div>
      </div>

      {/* Generate bill */}
      <Button
        size="lg"
        className="w-full"
        disabled={!hasItems || billing}
        onClick={handleGenerateBill}
      >
        {billing ? (
          <Loader2 className="mr-1 size-4 animate-spin" />
        ) : (
          <Receipt className="mr-1 size-4" />
        )}
        Generate Bill · {formatMoney(currency, runningTotal)}
      </Button>

      {/* §0.1 walk-outs: clear without billing (cancelled, never revenue) */}
      {hasItems && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-destructive hover:text-destructive"
          disabled={billing}
          onClick={() => setClearOpen(true)}
        >
          Clear table (no bill)
        </Button>
      )}

      {/* Clear-table reason dialog */}
      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear {tableLabel} without billing?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            All approved orders on this table are cancelled and never counted
            as revenue. The records stay in your Orders history.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {["Customer left", "Wrong table", "Order mistake", "Test order"].map((r) => (
              <button
                key={r}
                onClick={() => setClearReason(r)}
                className={`rounded-full border px-2.5 py-1 text-xs ${
                  clearReason === r ? "bg-destructive text-white" : "hover:bg-muted"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <Input
            placeholder="Or type a reason…"
            value={clearReason}
            onChange={(e) => setClearReason(e.target.value)}
            maxLength={200}
          />
          <Button
            variant="destructive"
            disabled={!clearReason.trim() || clearing}
            onClick={handleClearTable}
          >
            {clearing ? "Clearing…" : "Clear table"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Order history strip */}
      {orders.length > 0 && (
        <div className="rounded-xl border bg-muted/20">
          <button
            onClick={() => setHistoryOpen((v) => !v)}
            className="flex w-full items-center justify-between p-3 text-sm font-medium"
          >
            <span>Order history ({orders.length})</span>
            <ChevronDown
              className={`size-4 transition-transform ${historyOpen ? "rotate-180" : ""}`}
            />
          </button>
          {historyOpen && (
            <ul className="divide-y border-t">
              {orders.map((o) => (
                <li key={o.id} className="p-3 text-xs">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-mono font-bold">#{o.short_id}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {o.source}
                    </Badge>
                    <span className="text-muted-foreground">
                      {minutesAgo(o.created_at)}
                    </span>
                  </div>
                  <span className="text-muted-foreground">
                    {o.items.map((i) => `${i.qty}× ${i.name}`).join(", ") || "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Add-item picker */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Add item</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search your menu…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="-mx-2 max-h-[55vh] overflow-y-auto px-2">
            {filteredMenu.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No items match.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {filteredMenu.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-lg border p-2.5"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {item.name}
                    </span>
                    {item.has_portions && item.price_half != null ? (
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAdd(item, "half")}
                        >
                          Half {formatMoney(currency, Number(item.price_half))}
                        </Button>
                        <Button size="sm" onClick={() => handleAdd(item, "full")}>
                          Full {formatMoney(currency, Number(item.price_full))}
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" onClick={() => handleAdd(item, null)}>
                        Add {formatMoney(currency, Number(item.price_full))}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
