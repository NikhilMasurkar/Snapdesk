"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Ban, Printer } from "lucide-react";
import { formatMoney } from "@/lib/money";
import type { Bill } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { voidBill } from "../actions";

type BusinessInfo = {
  name: string;
  logo_url: string | null;
  address: string | null;
  city: string | null;
  gst_number: string | null;
  currency: string;
};

export default function BillView({
  bill,
  business,
  autoPrint,
}: {
  bill: Bill;
  business: BusinessInfo;
  autoPrint: boolean;
}) {
  const router = useRouter();
  const [voidOpen, setVoidOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [voiding, setVoiding] = useState(false);
  const printed = useRef(false);

  useEffect(() => {
    if (autoPrint && !printed.current) {
      printed.current = true;
      // Let the receipt paint before invoking the print dialog.
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [autoPrint]);

  const created = new Date(bill.created_at);
  const c = business.currency;

  const handleVoid = async () => {
    if (voiding) return;
    setVoiding(true);
    const res = await voidBill(bill.id, reason);
    setVoiding(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setVoidOpen(false);
    toast.success("Bill voided");
    router.refresh();
  };

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Print rules: hide the app chrome, size for an 80mm thermal roll. */}
      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 4mm; }
          body * { visibility: hidden; }
          #bill-receipt, #bill-receipt * { visibility: visible; }
          #bill-receipt {
            position: absolute; left: 0; top: 0; width: 72mm;
            font-family: ui-monospace, monospace; color: #000;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Screen-only controls */}
      <div className="no-print flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
        <Button variant="outline" size="sm" className="rounded-xl font-medium shadow-2xs" asChild>
          <Link href="/dashboard/tables">
            <ArrowLeft className="mr-1.5 size-4" /> Back to Tables
          </Link>
        </Button>
        <div className="flex gap-2">
          {!bill.is_void && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive font-medium"
              onClick={() => setVoidOpen(true)}
            >
              <Ban className="mr-1 size-4" /> Void
            </Button>
          )}
          <Button size="sm" className="rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs" onClick={() => window.print()}>
            <Printer className="mr-1.5 size-4" /> Print Bill
          </Button>
        </div>
      </div>

      {/* Receipt Preview */}
      <div className="no-print mx-auto flex w-full max-w-[340px] flex-col items-center">
        <span className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Receipt Preview</span>
      </div>

      <div
        id="bill-receipt"
        className="relative mx-auto w-full max-w-[340px] rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-900 shadow-lg"
      >
        {bill.is_void && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rotate-[-20deg] rounded border-4 border-red-600 px-4 py-1 text-3xl font-extrabold tracking-widest text-red-600 opacity-80">
              VOID
            </span>
          </div>
        )}

        <div className="text-center">
          {business.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={business.logo_url}
              alt=""
              className="mx-auto mb-2 h-12 w-12 rounded-full object-cover"
            />
          )}
          <h2 className="text-base font-bold">{business.name}</h2>
          {business.address && (
            <p className="text-xs">
              {business.address}
              {business.city ? `, ${business.city}` : ""}
            </p>
          )}
          {business.gst_number && (
            <p className="text-xs">GST: {business.gst_number}</p>
          )}
        </div>

        <div className="my-3 border-t border-dashed border-black/40" />

        <div className="flex justify-between text-xs">
          <span>Bill #{bill.bill_no}</span>
          <span>{bill.table_no ? `Table ${bill.table_no}` : "Counter"}</span>
        </div>
        <div className="text-xs">{created.toLocaleString()}</div>

        <div className="my-3 border-t border-dashed border-black/40" />

        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-black/20 text-left">
              <th className="pb-1 font-semibold">Item</th>
              <th className="pb-1 text-center font-semibold">Qty</th>
              <th className="pb-1 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {bill.items.map((it, i) => (
              <tr key={i}>
                <td className="py-0.5 align-top">
                  {it.name}
                  {it.portion ? ` (${it.portion})` : ""}
                </td>
                <td className="py-0.5 text-center align-top">{it.qty}</td>
                <td className="py-0.5 text-right align-top tabular-nums">
                  {formatMoney(c, it.line_total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="my-3 border-t border-dashed border-black/40" />

        <div className="flex justify-between text-base font-bold">
          <span>Total</span>
          <span className="tabular-nums">{formatMoney(c, bill.total)}</span>
        </div>

        {bill.is_void && bill.void_reason && (
          <p className="mt-2 text-center text-xs text-red-600">
            Voided: {bill.void_reason}
          </p>
        )}

        <p className="mt-4 text-center text-xs">Thank you! Please visit again.</p>
        <p className="mt-1 text-center text-[10px] text-black/50">
          Powered by Snapdesk
        </p>
      </div>

      {/* Void dialog */}
      <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void this bill?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            The bill stays on record with a VOID stamp and stops counting toward
            revenue. This can&apos;t be undone.
          </p>
          <Textarea
            placeholder="Reason (required) — e.g. wrong table, duplicate bill"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={200}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={voiding || !reason.trim()}
              onClick={handleVoid}
            >
              {voiding ? "Voiding…" : "Void bill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
