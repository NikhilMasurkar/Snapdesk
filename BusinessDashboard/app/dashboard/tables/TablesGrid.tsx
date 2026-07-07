"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Bell, Clock, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/money";
import type { Order } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { approveOrder, rejectOrder, setAcceptingOrders } from "./actions";

const COUNTER_KEY = "__counter__";

/** Bucket an order onto a tile: real table number, else the Counter tile. */
function bucketKey(tableNo: string | null): string {
  return tableNo && tableNo.trim() ? tableNo.trim() : COUNTER_KEY;
}

function tileLabel(key: string): string {
  return key === COUNTER_KEY ? "Counter" : `Table ${key}`;
}

function minutesAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} mins ago`;
  const h = Math.floor(mins / 60);
  return h === 1 ? "1 hr ago" : `${h} hrs ago`;
}

type Props = {
  businessId: string;
  tableCount: number;
  currency: string;
  acceptingOrders: boolean;
  initialOrders: Order[];
};

export default function TablesGrid({
  businessId,
  tableCount,
  currency,
  acceptingOrders,
  initialOrders,
}: Props) {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [accepting, setAccepting] = useState(acceptingOrders);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  // Keep local state in sync if the server component re-renders (revalidate).
  const initialRef = useRef(initialOrders);
  useEffect(() => {
    if (initialRef.current !== initialOrders) {
      initialRef.current = initialOrders;
      setOrders(initialOrders);
    }
  }, [initialOrders]);

  // ── Notification: chime + tab-title flash ─────────────────────────────────
  const audioCtxRef = useRef<AudioContext | null>(null);
  const flashRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopFlash = useCallback(() => {
    if (flashRef.current) {
      clearInterval(flashRef.current);
      flashRef.current = null;
      document.title = "Tables · Snapdesk";
    }
  }, []);

  const notify = useCallback(() => {
    // Short two-note chime via WebAudio — no asset needed.
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      audioCtxRef.current ??= new Ctx();
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") void ctx.resume();
      [880, 1175].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        osc.type = "sine";
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + i * 0.15 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.15 + 0.25);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.15);
        osc.stop(ctx.currentTime + i * 0.15 + 0.25);
      });
    } catch {
      // Audio blocked (autoplay policy) — the visual cues still fire.
    }
    // Flash the tab title until the owner looks at the page.
    if (!flashRef.current && document.hidden) {
      let on = false;
      flashRef.current = setInterval(() => {
        document.title = on ? "Tables · Snapdesk" : "● New order!";
        on = !on;
      }, 900);
    }
  }, []);

  // ── Supabase Realtime: live orders for THIS business only (RLS-scoped) ─────
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`orders-${businessId}`).on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "orders",
        filter: `business_id=eq.${businessId}`,
      },
      (payload) => {
        const row = payload.new as Order;
        if (payload.eventType === "INSERT") {
          setOrders((prev) =>
            prev.some((o) => o.id === row.id) ? prev : [...prev, row]
          );
          if (row.status === "pending" && row.source === "customer") notify();
        } else if (payload.eventType === "UPDATE") {
          setOrders((prev) => {
            const next = prev.map((o) => (o.id === row.id ? row : o));
            // Drop rows that left the open set (billed / rejected).
            return next.filter(
              (o) => o.status === "pending" || o.status === "approved"
            );
          });
        } else if (payload.eventType === "DELETE") {
          const old = payload.old as { id: string };
          setOrders((prev) => prev.filter((o) => o.id !== old.id));
        }
      }
    );

    // @supabase/ssr keeps the session in cookies, so the Realtime socket
    // starts as anon (which can't read orders under RLS → zero events).
    // Hand it the owner's access token before subscribing.
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
  }, [businessId, notify]);

  // Returning to the tab: stop the flash and re-sync from the server.
  useEffect(() => {
    const onFocus = () => {
      stopFlash();
      router.refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [router, stopFlash]);

  useEffect(() => () => stopFlash(), [stopFlash]);

  // ── Derived: bucket orders per tile ───────────────────────────────────────
  const byTile = useMemo(() => {
    const map = new Map<string, Order[]>();
    for (const o of orders) {
      const k = bucketKey(o.table_no);
      const arr = map.get(k) ?? [];
      arr.push(o);
      map.set(k, arr);
    }
    return map;
  }, [orders]);

  // Tile keys = numbered tables + counter + any stray table_no seen in orders.
  const tileKeys = useMemo(() => {
    const keys: string[] = [];
    for (let i = 1; i <= tableCount; i++) keys.push(String(i));
    const known = new Set(keys);
    for (const k of byTile.keys()) {
      if (k !== COUNTER_KEY && !known.has(k)) keys.push(k);
    }
    keys.push(COUNTER_KEY);
    return keys;
  }, [tableCount, byTile]);

  const totalPending = useMemo(
    () => orders.filter((o) => o.status === "pending").length,
    [orders]
  );

  const selectedOrders = selectedKey ? byTile.get(selectedKey) ?? [] : [];

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleDecision = async (
    order: Order,
    decision: "approve" | "reject"
  ) => {
    setBusyOrderId(order.id);
    // Optimistic: reflect the decision immediately.
    setOrders((prev) =>
      decision === "approve"
        ? prev.map((o) => (o.id === order.id ? { ...o, status: "approved" } : o))
        : prev.filter((o) => o.id !== order.id)
    );
    const res =
      decision === "approve"
        ? await approveOrder(order.id)
        : await rejectOrder(order.id);
    setBusyOrderId(null);
    if (!res.ok) {
      toast.error(res.error);
      router.refresh(); // reconcile from the server on failure
      return;
    }
    toast.success(
      decision === "approve"
        ? `Order #${order.short_id} approved`
        : `Order #${order.short_id} rejected`
    );
  };

  const handleAcceptingToggle = async (next: boolean) => {
    setAccepting(next);
    const res = await setAcceptingOrders(next);
    if (!res.ok) {
      setAccepting(!next);
      toast.error(res.error);
    } else {
      toast.success(next ? "Now accepting orders" : "Orders paused");
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tables</h1>
          <p className="text-sm text-muted-foreground">
            Live orders across your tables. New orders appear automatically.
          </p>
        </div>
        <label className="flex items-center gap-2.5 rounded-lg border bg-background px-3 py-2">
          <span
            className={`size-2 rounded-full ${
              accepting ? "bg-emerald-500" : "bg-zinc-400"
            }`}
          />
          <span className="text-sm font-medium">
            {accepting ? "Accepting orders" : "Orders paused"}
          </span>
          <Switch checked={accepting} onCheckedChange={handleAcceptingToggle} />
        </label>
      </div>

      {!accepting && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          You&apos;re not accepting orders right now. Customers can browse your
          menu but can&apos;t place orders.
        </div>
      )}

      {totalPending > 0 && (
        <div className="flex items-center gap-2 text-sm font-medium text-amber-600">
          <Bell className="size-4" />
          {totalPending} order{totalPending > 1 ? "s" : ""} waiting for approval
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {tileKeys.map((key) => {
          const tileOrders = byTile.get(key) ?? [];
          const pending = tileOrders.filter((o) => o.status === "pending");
          const approved = tileOrders.filter((o) => o.status === "approved");
          const runningTotal = approved.reduce((s, o) => s + Number(o.total), 0);
          const hasPending = pending.length > 0;
          const occupied = approved.length > 0;

          return (
            <button
              key={key}
              onClick={() => setSelectedKey(key)}
              className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 p-3 text-center transition-all ${
                hasPending
                  ? "animate-pulse border-amber-400 bg-amber-50 dark:bg-amber-950/30"
                  : occupied
                    ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30"
                    : "border-dashed border-muted bg-muted/20 hover:border-muted-foreground/40"
              }`}
            >
              <span className="text-sm font-semibold">{tileLabel(key)}</span>
              {hasPending && (
                <Badge className="bg-amber-500 text-amber-950 hover:bg-amber-500">
                  {pending.length} new
                </Badge>
              )}
              {!hasPending && occupied && (
                <span className="text-base font-bold text-emerald-700 dark:text-emerald-400">
                  {formatMoney(currency, runningTotal)}
                </span>
              )}
              {!hasPending && !occupied && (
                <span className="text-xs text-muted-foreground">Empty</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Per-table dialog */}
      <Dialog
        open={selectedKey !== null}
        onOpenChange={(o) => !o && setSelectedKey(null)}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedKey ? tileLabel(selectedKey) : ""}
            </DialogTitle>
            <DialogDescription>
              {selectedOrders.length === 0
                ? "No open orders on this table."
                : "Approve or reject new orders. Approved orders build the table's running total."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            {selectedOrders
              .slice()
              .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
              .map((order) => (
                <div
                  key={order.id}
                  className={`rounded-lg border p-3 ${
                    order.status === "pending"
                      ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20"
                      : "border-muted"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold">
                        #{order.short_id}
                      </span>
                      <Badge
                        variant={
                          order.status === "pending" ? "default" : "secondary"
                        }
                        className={
                          order.status === "pending"
                            ? "bg-amber-500 text-amber-950 hover:bg-amber-500"
                            : ""
                        }
                      >
                        {order.status}
                      </Badge>
                      {order.source === "staff" && (
                        <Badge variant="outline">staff</Badge>
                      )}
                    </div>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3" />
                      {minutesAgo(order.created_at)}
                    </span>
                  </div>

                  <ul className="mt-2 flex flex-col gap-0.5 text-sm">
                    {order.items.map((it, i) => (
                      <li key={i} className="flex justify-between">
                        <span>
                          {it.qty}× {it.name}
                          {it.portion ? (
                            <span className="text-muted-foreground">
                              {" "}
                              ({it.portion})
                            </span>
                          ) : null}
                        </span>
                        <span className="tabular-nums">
                          {formatMoney(currency, it.line_total)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {order.note && (
                    <p className="mt-1.5 rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                      Note: {order.note}
                    </p>
                  )}

                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm font-semibold">
                      {formatMoney(currency, Number(order.total))}
                    </span>
                    {order.status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyOrderId === order.id}
                          onClick={() => handleDecision(order, "reject")}
                          className="text-destructive hover:text-destructive"
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          disabled={busyOrderId === order.id}
                          onClick={() => handleDecision(order, "approve")}
                        >
                          {busyOrderId === order.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            "Approve"
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>

          {selectedKey && selectedOrders.some((o) => o.status === "approved") && (
            <Button asChild className="w-full">
              <Link
                href={`/dashboard/tables/${encodeURIComponent(selectedKey)}`}
              >
                Open table for billing
                <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
