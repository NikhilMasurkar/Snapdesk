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

        const nameSize = 13;
        const nameWidth = bold.widthOfTextAtSize(businessName, nameSize);
        page.drawText(businessName, {
          x: x + (cardW - nameWidth) / 2,
          y: yTop - 30,
          size: nameSize,
          font: bold,
          color: rgb(0.1, 0.1, 0.1),
        });

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

        const labelSize = 16;
        const labelWidth = bold.widthOfTextAtSize(cards[idx].label, labelSize);
        page.drawText(cards[idx].label, {
          x: x + (cardW - labelWidth) / 2,
          y: yTop - 48 - qrSize - 24,
          size: labelSize,
          font: bold,
          color: rgb(0.1, 0.1, 0.1),
        });

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
      className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-hover px-4 py-3 text-xs font-bold text-primary-foreground shadow-md hover:shadow-primary/20 transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
    >
      {busy ? (
        <>
          <svg className="animate-spin h-4 w-4 text-current" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Generating PDF Cards…
        </>
      ) : (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="size-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.617 0-1.11-.461-1.12-1.078L5.82 18m12.06 0H6.12m1.724-4.171L8.52 4.5A2.25 2.25 0 0 1 10.758 2.25h2.484A2.25 2.25 0 0 1 15.48 4.5l.675 9.329m-8.314-1.2h.008v.008H7.842v-.008Zm4.186 0h.008v.008h-.008v-.008Zm4.187 0h.008v.008h-.008v-.008Z" />
          </svg>
          Generate QR PDF ({tableCount + 1} cards)
        </>
      )}
    </button>
  );
}
