"use client";

import { useState } from "react";
import type { Bill } from "@/lib/types";
import { money } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Timeframe = "day" | "month" | "year";

export default function RevenueAnalytics({ bills }: { bills: Bill[] }) {
  const [timeframe, setTimeframe] = useState<Timeframe>("month");

  const paidBills = bills.filter((b) => !b.is_void);

  // Current reference dates
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();

  // 1. Daily Revenue (Today)
  const todayRevenue = paidBills
    .filter((b) => {
      const d = new Date(b.created_at);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth && d.getDate() === currentDay;
    })
    .reduce((sum, b) => sum + Number(b.total), 0);

  // 2. Monthly Revenue (This Month)
  const monthRevenue = paidBills
    .filter((b) => {
      const d = new Date(b.created_at);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    })
    .reduce((sum, b) => sum + Number(b.total), 0);

  // 3. Yearly Revenue (This Year)
  const yearRevenue = paidBills
    .filter((b) => {
      const d = new Date(b.created_at);
      return d.getFullYear() === currentYear;
    })
    .reduce((sum, b) => sum + Number(b.total), 0);

  // Compute Chart Series based on active timeframe
  const getChartData = () => {
    if (timeframe === "day") {
      // 24 hours of today
      const hours = Array.from({ length: 24 }, (_, i) => {
        const hourLabel = i === 0 ? "12 AM" : i < 12 ? `${i} AM` : i === 12 ? "12 PM" : `${i - 12} PM`;
        return { label: hourLabel, value: 0 };
      });

      paidBills.forEach((b) => {
        const d = new Date(b.created_at);
        if (d.getFullYear() === currentYear && d.getMonth() === currentMonth && d.getDate() === currentDay) {
          hours[d.getHours()].value += Number(b.total);
        }
      });
      return {
        title: "Hourly Revenue Graph (Today)",
        series: hours,
      };
    } else if (timeframe === "month") {
      // Days of the current month
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      const days = Array.from({ length: daysInMonth }, (_, i) => ({
        label: `Day ${i + 1}`,
        value: 0,
      }));

      paidBills.forEach((b) => {
        const d = new Date(b.created_at);
        if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
          days[d.getDate() - 1].value += Number(b.total);
        }
      });
      return {
        title: "Daily Revenue Graph (This Month)",
        series: days,
      };
    } else {
      // 12 months of the year
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const months = monthNames.map((m) => ({ label: m, value: 0 }));

      paidBills.forEach((b) => {
        const d = new Date(b.created_at);
        if (d.getFullYear() === currentYear) {
          months[d.getMonth()].value += Number(b.total);
        }
      });
      return {
        title: "Monthly Revenue Graph (This Year)",
        series: months,
      };
    }
  };

  const { title, series } = getChartData();
  const maxValue = Math.max(...series.map((s) => s.value), 1);

  return (
    <div className="flex flex-col gap-6">
      {/* Top Summary Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Daily Revenue (Today)</p>
          <p className="mt-2 text-2xl font-black text-foreground">{money(todayRevenue)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Monthly Revenue (This Month)</p>
          <p className="mt-2 text-2xl font-black text-primary">{money(monthRevenue)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Yearly Revenue (This Year)</p>
          <p className="mt-2 text-2xl font-black text-foreground">{money(yearRevenue)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Paid Invoices</p>
          <p className="mt-2 text-2xl font-black text-foreground">{paidBills.length}</p>
        </div>
      </div>

      {/* Interactive Timeframe Chart Section */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h2 className="text-sm font-extrabold text-foreground">{title}</h2>
            <p className="text-xs text-muted">Interactive breakdown of revenue collected</p>
          </div>

          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-background p-1">
            <Button variant="ghost"
              onClick={() => setTimeframe("day")}
              className={`h-auto rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                timeframe === "day"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Day (Hourly)
            </Button>
            <Button variant="ghost"
              onClick={() => setTimeframe("month")}
              className={`h-auto rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                timeframe === "month"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Month (Daily)
            </Button>
            <Button variant="ghost"
              onClick={() => setTimeframe("year")}
              className={`h-auto rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                timeframe === "year"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Year (Monthly)
            </Button>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="h-56 flex items-end gap-1.5 pt-6 pb-2">
          {series.map((s, idx) => {
            const heightPct = Math.round((s.value / maxValue) * 100);
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                <div className="w-full flex-1 flex items-end">
                  <div
                    style={{ height: `${Math.max(heightPct, 4)}%` }}
                    className={`w-full rounded-t-sm transition-all duration-300 ${
                      s.value > 0
                        ? "bg-primary group-hover:brightness-110"
                        : "bg-muted-bg"
                    }`}
                    title={`${s.label}: ${money(s.value)}`}
                  />
                </div>
                <span className="text-[9px] font-bold text-muted truncate max-w-full">
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Billing Log Table */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
            All Invoices & Bills ({bills.length})
          </h2>
        </div>
        {bills.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted">No invoices generated yet.</p>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <Table className="w-full text-left text-xs border-collapse">
              <TableHeader>
                <TableRow className="border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted">
                  <TableHead className="pb-3 pr-4">Bill No</TableHead>
                  <TableHead className="pb-3 px-4">Table</TableHead>
                  <TableHead className="pb-3 px-4 text-right">Invoice Total</TableHead>
                  <TableHead className="pb-3 pl-4">Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border/60">
                {bills.map((b) => (
                  <TableRow key={b.id} className={`hover:bg-muted-bg/30 transition-colors ${b.is_void ? "opacity-45" : ""}`}>
                    <TableCell className="py-3 pr-4 font-mono font-bold text-foreground">
                      #{b.bill_no}
                      {b.is_void && (
                        <span className="ml-2 inline-flex items-center rounded bg-danger-bg px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-danger">
                          Void
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="py-3 px-4 font-semibold text-foreground">{b.table_no ?? "Counter"}</TableCell>
                    <TableCell className={`py-3 px-4 text-right font-extrabold tabular-nums ${b.is_void ? "text-danger line-through" : "text-foreground"}`}>
                      {money(Number(b.total))}
                    </TableCell>
                    <TableCell className="py-3 pl-4 text-muted" suppressHydrationWarning>{new Date(b.created_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
