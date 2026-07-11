"use client";

import { useEffect, useRef, useState } from "react";
import { ChefHat, Clock, Maximize2, Minimize2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Order } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function minutesSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

export default function KitchenBoard({
  businessId,
  businessName,
  initialOrders,
}: {
  businessId: string;
  businessName: string;
  initialOrders: Order[];
}) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [fullscreen, setFullscreen] = useState(false);
  // re-render every 30s so the elapsed-minutes chips stay honest
  const [, setTick] = useState(0);
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Same realtime pattern as TablesGrid: setAuth before subscribe, else the
  // anon socket gets zero RLS-scoped events.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`kitchen-${businessId}`).on(
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
        } else if (payload.eventType === "UPDATE") {
          setOrders((prev) =>
            prev
              .map((o) => (o.id === row.id ? row : o))
              .filter((o) => o.status === "pending" || o.status === "approved")
          );
        } else if (payload.eventType === "DELETE") {
          const old = payload.old as { id: string };
          setOrders((prev) => prev.filter((o) => o.id !== old.id));
        }
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
  }, [businessId]);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await boardRef.current?.requestFullscreen().catch(() => {});
      setFullscreen(true);
    } else {
      await document.exitFullscreen().catch(() => {});
      setFullscreen(false);
    }
  };

  // Kitchen only cooks accepted orders; pending ones show dimmed as "incoming".
  const cooking = orders.filter((o) => o.status === "approved");
  const incoming = orders.filter((o) => o.status === "pending");

  return (
    <div ref={boardRef} className="flex min-h-full flex-col gap-4 bg-background p-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChefHat className="size-6" />
          <div>
            <h1 className="text-xl font-bold leading-tight tracking-tight">Kitchen</h1>
            <p className="text-xs text-muted-foreground">{businessName} — live orders</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {incoming.length > 0 && (
            <Badge variant="outline" className="border-amber-400 text-amber-600">
              {incoming.length} awaiting approval
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={toggleFullscreen}>
            {fullscreen ? (
              <Minimize2 className="size-4" />
            ) : (
              <Maximize2 className="size-4" />
            )}
            <span className="ml-1.5 hidden sm:inline">
              {fullscreen ? "Exit" : "Fullscreen"}
            </span>
          </Button>
        </div>
      </div>

      {cooking.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-24 text-center">
          <ChefHat className="size-10 text-muted-foreground/40" />
          <p className="text-lg font-semibold text-muted-foreground">
            No orders to prepare
          </p>
          <p className="text-sm text-muted-foreground/70">
            Approved orders appear here instantly.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cooking.map((o) => {
            const mins = minutesSince(o.created_at);
            const late = mins >= 20;
            return (
              <div
                key={o.id}
                className={`flex flex-col rounded-xl border-2 bg-card shadow-sm ${
                  late ? "border-red-400" : "border-emerald-300 dark:border-emerald-800"
                }`}
              >
                <div className="flex items-center justify-between rounded-t-[10px] bg-muted/40 px-4 py-2.5">
                  <span className="text-lg font-black">
                    {o.table_no ? `Table ${o.table_no}` : "Counter"}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-muted-foreground">
                      #{o.short_id}
                    </span>
                    <Badge
                      variant={late ? "destructive" : "secondary"}
                      className="gap-1 tabular-nums"
                    >
                      <Clock className="size-3" />
                      {mins}m
                    </Badge>
                  </div>
                </div>
                <ul className="flex-1 space-y-1.5 px-4 py-3">
                  {o.items.map((it, i) => (
                    <li key={i} className="flex items-baseline gap-2 text-base">
                      <span className="font-black tabular-nums">{it.qty}×</span>
                      <span className="font-medium leading-snug">
                        {it.name}
                        {it.portion && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({it.portion})
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                {o.note && (
                  <p className="border-t px-4 py-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
                    ✎ {o.note}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
