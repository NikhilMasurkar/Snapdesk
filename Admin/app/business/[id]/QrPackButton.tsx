"use client";

import { useState } from "react";
import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type Props = {
  slug: string;
  businessName: string;
  tableCount: number;
  menuBaseUrl: string;
};

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1];
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export default function QrPackButton({
  slug,
  businessName,
  tableCount,
  menuBaseUrl,
}: Props) {
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      // One card per table + one Counter card (no ?table param).
      const cards: { label: string; url: string }[] = [];
      for (let i = 1; i <= tableCount; i++) {
        cards.push({
          label: `Table ${i}`,
          url: `${menuBaseUrl}/m/${slug}?table=${i}`,
        });
      }
      cards.push({ label: "Counter", url: `${menuBaseUrl}/m/${slug}` });

      const pdf = await PDFDocument.create();
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

      // A4 portrait, 2 columns × 3 rows of cards.
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
        // PDF origin is bottom-left; lay rows top→down.
        const yTop = A4.h - margin - row * cardH;

        // Card border
        page.drawRectangle({
          x: x + 6,
          y: yTop - cardH + 6,
          width: cardW - 12,
          height: cardH - 12,
          borderColor: rgb(0.8, 0.8, 0.8),
          borderWidth: 1,
        });

        // Business name
        const nameSize = 13;
        const nameWidth = bold.widthOfTextAtSize(businessName, nameSize);
        page.drawText(businessName, {
          x: x + (cardW - nameWidth) / 2,
          y: yTop - 30,
          size: nameSize,
          font: bold,
          color: rgb(0.1, 0.1, 0.1),
        });

        // QR
        const qrDataUrl = await QRCode.toDataURL(cards[idx].url, {
          width: 300,
          margin: 1,
        });
        const qrImg = await pdf.embedPng(dataUrlToBytes(qrDataUrl));
        page.drawImage(qrImg, {
          x: x + (cardW - qrSize) / 2,
          y: yTop - 48 - qrSize,
          width: qrSize,
          height: qrSize,
        });

        // Table label
        const labelSize = 16;
        const labelWidth = bold.widthOfTextAtSize(cards[idx].label, labelSize);
        page.drawText(cards[idx].label, {
          x: x + (cardW - labelWidth) / 2,
          y: yTop - 48 - qrSize - 24,
          size: labelSize,
          font: bold,
          color: rgb(0.1, 0.1, 0.1),
        });

        // Instruction
        const instr = "Scan to view menu & order";
        const instrSize = 9;
        const instrWidth = font.widthOfTextAtSize(instr, instrSize);
        page.drawText(instr, {
          x: x + (cardW - instrWidth) / 2,
          y: yTop - 48 - qrSize - 42,
          size: instrSize,
          font,
          color: rgb(0.4, 0.4, 0.4),
        });
      }

      const bytes = await pdf.save();
      // Copy into a fresh ArrayBuffer-backed view so the Blob typing is happy.
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
    <button
      onClick={generate}
      disabled={busy || tableCount < 1}
      className="rounded-lg bg-white px-4 py-2 text-xs font-bold text-zinc-950 hover:bg-zinc-200 disabled:opacity-50"
    >
      {busy ? "Generating…" : `Generate QR PDF (${tableCount + 1} cards)`}
    </button>
  );
}
