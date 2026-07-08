"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronsUpDown,
  ExternalLink,
  LayoutGrid,
  LogOut,
  Menu,
  MessageSquareQuote,
  Receipt,
  Settings,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Business, BusinessFeatures } from "@/lib/types";
import { logout } from "@/app/login/actions";

type SidebarProps = {
  business: Business;
  user: {
    id: string;
    email?: string;
  };
  features: BusinessFeatures;
  pendingTestimonialsCount: number;
  pendingOrdersCount: number;
  liveMenuUrl: string;
};

export default function Sidebar({
  business,
  user,
  features,
  pendingTestimonialsCount,
  pendingOrdersCount,
  liveMenuUrl,
}: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    // Tables hidden for counter-mode businesses (tables_enabled=false).
    ...(features.tables_enabled
      ? [
          {
            href: "/dashboard/tables",
            label: "Tables",
            icon: LayoutGrid,
            badge: pendingOrdersCount > 0 ? pendingOrdersCount : null,
          },
        ]
      : []),
    // Orders history: relevant wherever orders happen (customer or staff).
    ...(features.ordering_enabled || features.tables_enabled
      ? [{ href: "/dashboard/orders", label: "Orders", icon: Receipt, badge: null }]
      : []),
    { href: "/dashboard/menu", label: "Menu", icon: UtensilsCrossed, badge: null },
    // Reviews hidden when testimonials are disabled for this plan.
    ...(features.testimonials_enabled
      ? [
          {
            href: "/dashboard/testimonials",
            label: "Testimonials",
            icon: MessageSquareQuote,
            badge: pendingTestimonialsCount > 0 ? pendingTestimonialsCount : null,
          },
        ]
      : []),
    { href: "/dashboard/settings", label: "Settings", icon: Settings, badge: null },
  ];

  const handleLogout = async () => {
    await logout();
  };

  const navLinks = (
    <nav className="flex flex-col gap-1.5 py-4">
      <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 select-none">
        Overview
      </p>
      
      {navItems.map(({ href, label, icon: Icon, badge }) => {
        const isActive = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/10"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
          >
            <div className="flex items-center gap-2.5">
              <Icon className="size-4 shrink-0" />
              <span>{label}</span>
            </div>
            {badge !== null && (
              <span
                className={cn(
                  "flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold tracking-tight",
                  isActive
                    ? "bg-primary-foreground text-primary"
                    : "bg-amber-500 text-amber-950"
                )}
              >
                {badge}
              </span>
            )}
          </Link>
        );
      })}

      <div className="mt-4 pt-4 border-t border-muted/60">
        <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 select-none">
          Quick Links
        </p>
        <a
          href={liveMenuUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 mt-1.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-muted/80 hover:text-foreground"
        >
          <ExternalLink className="size-4 shrink-0" />
          <span>View Live Menu</span>
        </a>
      </div>
    </nav>
  );

  return (
    <>
      {/* Mobile Top Header */}
      <header className="flex h-16 w-full items-center justify-between border-b bg-background/95 backdrop-blur px-4 md:hidden sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
            {business.name.charAt(0)}
          </div>
          <span className="font-semibold tracking-tight text-foreground">{business.name}</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex size-9 items-center justify-center rounded-md border border-muted hover:bg-muted/50 transition-colors"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </header>

      {/* Mobile Sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 top-16 z-30 bg-background/80 backdrop-blur-sm md:hidden animate-fade-in">
          <aside className="h-[calc(100vh-4rem)] w-full max-w-[280px] bg-background border-r p-4 flex flex-col shadow-xl">
            {/* Nav list */}
            <div className="flex-1 overflow-y-auto">{navLinks}</div>

            {/* Logout/Account block at bottom of mobile sidebar */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                    {business.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">{business.name}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex size-8 items-center justify-center rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                  title="Log out"
                >
                  <LogOut className="size-4" />
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex h-screen w-64 flex-col border-r bg-zinc-50/50 dark:bg-zinc-900/10 p-4 shrink-0 sticky top-0">
        {/* Business Selector / User Dropdown */}
        <div className="w-full">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center justify-between gap-3 rounded-lg border bg-background p-2 text-left hover:bg-muted/50 transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring select-none">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                    {business.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold tracking-tight text-foreground">
                      {business.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </div>
                <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground/60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-56"
              align="start"
              alignOffset={0}
              side="bottom"
            >
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{business.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a
                  href={liveMenuUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="cursor-pointer flex items-center w-full"
                >
                  <ExternalLink className="mr-2 size-4 text-muted-foreground" />
                  <span>View Live Menu</span>
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings" className="cursor-pointer flex items-center w-full">
                  <Settings className="mr-2 size-4 text-muted-foreground" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer flex items-center w-full"
              >
                <LogOut className="mr-2 size-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Navigation Section */}
        <div className="flex-1 overflow-y-auto mt-4">{navLinks}</div>
      </aside>
    </>
  );
}
