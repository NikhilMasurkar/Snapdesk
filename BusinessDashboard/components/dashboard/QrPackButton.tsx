"use client";

// ponytail: mirrors Admin/app/business/[id]/QrPackButton.tsx — same generator,
// different button chrome. No shared package between the two Next apps.
import { useState } from "react";
import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const bin = atob(dataUrl.split(",")[1]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export default function QrPackButton({
  slug,
  businessName,
  tableCount,
  menuBaseUrl,
}: {
  slug: string;
  businessName: string;
  tableCount: number;
  menuBaseUrl: string;
}) {
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const cards: { label: string; url: string }[] = [];
      for (let i = 1; i <= tableCount; i++) {
        cards.push({ label: `Table ${i}`, url: `${menuBaseUrl}/m/${slug}?table=${i}` });
      }
      cards.push({ label: "Counter", url: `${menuBaseUrl}/m/${slug}` });

      const pdf = await PDFDocument.create();
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
      const A4 = { w: 595.28, h: 841.89 };
      const margin = 36;
      const cols = 2;
      const rows = 3;
      const perPage = cols * rows;
      const cardW = (A4.w - margin * 2) / cols;
      const cardH = (A4.h - margin * 2) / rows;
      const qrSize = 150;

      for (let idx = 0; idx < cards.length; idx++) {
        if (idx % perPage === 0) pdf.addPage([A4.w, A4.h]);
        const page = pdf.getPages()[pdf.getPageCount() - 1];
        const slot = idx % perPage;
        const col = slot % cols;
        const row = Math.floor(slot / cols);
        const x = margin + col * cardW;
        const yTop = A4.h - margin - row * cardH;

        page.drawRectangle({
          x: x + 6,
          y: yTop - cardH + 6,
          width: cardW - 12,
          height: cardH - 12,
          borderColor: rgb(0.8, 0.8, 0.8),
          borderWidth: 1,
        });

        const nameWidth = bold.widthOfTextAtSize(businessName, 13);
        page.drawText(businessName, {
          x: x + (cardW - nameWidth) / 2,
          y: yTop - 30,
          size: 13,
          font: bold,
          color: rgb(0.1, 0.1, 0.1),
        });

        const qrDataUrl = await QRCode.toDataURL(cards[idx].url, { width: 300, margin: 1 });
        const qrImg = await pdf.embedPng(dataUrlToBytes(qrDataUrl));
        page.drawImage(qrImg, {
          x: x + (cardW - qrSize) / 2,
          y: yTop - 48 - qrSize,
          width: qrSize,
          height: qrSize,
        });

        const labelWidth = bold.widthOfTextAtSize(cards[idx].label, 16);
        page.drawText(cards[idx].label, {
          x: x + (cardW - labelWidth) / 2,
          y: yTop - 48 - qrSize - 24,
          size: 16,
          font: bold,
          color: rgb(0.1, 0.1, 0.1),
        });

        const instr = "Scan to view menu & order";
        const instrWidth = font.widthOfTextAtSize(instr, 9);
        page.drawText(instr, {
          x: x + (cardW - instrWidth) / 2,
          y: yTop - 48 - qrSize - 42,
          size: 9,
          font,
          color: rgb(0.4, 0.4, 0.4),
        });
      }

      const bytes = await pdf.save();
      const blob = new Blob([bytes.slice()], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}-qr-pack.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button onClick={generate} disabled={busy || tableCount < 1}>
      {busy ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Download className="mr-1 size-4" />}
      Download QR pack ({tableCount + 1} cards)
    </Button>
  );
}
