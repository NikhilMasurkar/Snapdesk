import Link from "next/link";

export default function MenuNotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <span className="text-5xl" aria-hidden>
        🍽️
      </span>
      <h1 className="text-xl font-semibold">This menu is not available</h1>
      <p className="max-w-xs text-sm text-zinc-600">
        The QR code may be outdated, or this business is no longer active.
        Please ask the staff for help.
      </p>
      <Link href="/" className="text-sm font-medium text-zinc-900 underline">
        Go home
      </Link>
    </main>
  );
}
