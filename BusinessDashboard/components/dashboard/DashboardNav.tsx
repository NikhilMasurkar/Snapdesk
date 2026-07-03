"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, MessageSquareQuote, Settings, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/testimonials", label: "Testimonials", icon: MessageSquareQuote },
];

export default function DashboardNav({ liveMenuUrl }: { liveMenuUrl: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col">
      {navItems.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            pathname.startsWith(href)
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
          )}
        >
          <Icon className="size-4" />
          {label}
        </Link>
      ))}
      <a
        href={liveMenuUrl}
        target="_blank"
        rel="noreferrer"
        className="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
      >
        <ExternalLink className="size-4" />
        Live menu
      </a>
    </nav>
  );
}
