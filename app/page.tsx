import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <h1 className="text-3xl font-bold tracking-tight">Snapdesk</h1>
      <p className="max-w-sm text-zinc-600">
        Scan a table QR code to open a business&apos;s menu and order on
        WhatsApp — no app, no login.
      </p>
      <div className="flex flex-col gap-2 text-sm">
        <Link
          href="/m/spice-garden?table=5"
          className="rounded-full bg-zinc-900 px-6 py-3 font-medium text-white"
        >
          Demo: Spice Garden (Table 5)
        </Link>
        <Link
          href="/m/glow-beauty"
          className="rounded-full border border-zinc-300 px-6 py-3 font-medium text-zinc-700"
        >
          Demo: Glow Beauty Parlour
        </Link>
      </div>
    </main>
  );
}
