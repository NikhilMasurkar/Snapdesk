"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { seg: "", label: "Overview" },
  { seg: "orders", label: "Orders" },
  { seg: "bills", label: "Bills & Revenue" },
  { seg: "scans", label: "Scans" },
];

export default function TabNav({ id }: { id: string }) {
  const pathname = usePathname();
  const base = `/business/${id}`;
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border px-6 lg:px-8">
      {TABS.map((t) => {
        const href = t.seg ? `${base}/${t.seg}` : base;
        const active = pathname === href;
        return (
          <Link
            key={t.seg}
            href={href}
            className={`-mb-px shrink-0 border-b-2 px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
