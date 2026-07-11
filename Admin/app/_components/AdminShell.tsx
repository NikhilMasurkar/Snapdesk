"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import { Button } from "@/components/ui/button";
import { logout } from "@/app/login/actions";

type Tab = "dashboard" | "businesses" | "pages" | "role-config" | "leads";

export interface AdminShellProps {
  userEmail: string;
  isSuperAdmin: boolean;
  /** canSalesMember(roles) — shows the Sales → Leads section. */
  showSales?: boolean;
  initialTab?: Tab;
  pendingCount?: number;
  dashboardContent?: React.ReactNode;
  businessesContent?: React.ReactNode;
  children?: React.ReactNode;
}

export default function AdminShell({
  userEmail,
  isSuperAdmin,
  showSales = false,
  initialTab = "dashboard",
  pendingCount = 0,
  dashboardContent,
  businessesContent,
  children,
}: AdminShellProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isEmployeeOpen, setIsEmployeeOpen] = useState(true);
  const [isSalesOpen, setIsSalesOpen] = useState(true);

  const handleNavClick = (tab: Tab) => {
    setIsMobileOpen(false);
    setActiveTab(tab);
    if (tab === "pages") {
      router.push("/pages");
    } else if (tab === "role-config") {
      router.push("/team");
    } else if (tab === "leads") {
      router.push("/leads");
    } else if (initialTab !== "dashboard" && initialTab !== "businesses") {
      // If we are currently on /team, /pages or /leads, navigate back to /
      router.push(tab === "businesses" ? "/?tab=businesses" : "/");
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground transition-colors duration-200">
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Side Drawer / Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card/95 backdrop-blur-xl transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isMobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-border px-6">
          <Link
            href="/"
            onClick={() => handleNavClick("dashboard")}
            className="flex items-center group"
          >
            <div>
              <span className="text-lg font-black tracking-tight text-foreground">
                Snapdesk <span className="text-primary">Admin</span>
              </span>
              <span className="block text-[10px] font-bold uppercase tracking-widest text-muted">
                Super Control
              </span>
            </div>
          </Link>

          {/* Mobile Close Button */}
          <Button variant="ghost"
            onClick={() => setIsMobileOpen(false)}
            className="h-auto rounded-lg p-1.5 text-muted hover:bg-muted-bg hover:text-foreground lg:hidden"
            aria-label="Close sidebar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1.5 overflow-y-auto px-4 py-6">
          <div className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted">
            Overview
          </div>

          {/* Dashboard Button */}
          <Button variant="ghost"
            onClick={() => handleNavClick("dashboard")}
            className={`h-auto flex w-full items-center justify-start gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all cursor-pointer ${
              activeTab === "dashboard"
                ? "bg-primary text-white shadow-md shadow-primary/25"
                : "text-muted hover:bg-muted-bg hover:text-foreground"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-5 shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
            </svg>
            <span>Dashboard</span>
          </Button>

          {/* Businesses Button */}
          <Button variant="ghost"
            onClick={() => handleNavClick("businesses")}
            className={`h-auto flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all cursor-pointer ${
              activeTab === "businesses"
                ? "bg-primary text-white shadow-md shadow-primary/25"
                : "text-muted hover:bg-muted-bg hover:text-foreground"
            }`}
          >
            <div className="flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-5 shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
              </svg>
              <span>Businesses</span>
            </div>
            {pendingCount > 0 && (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                activeTab === "businesses" ? "bg-white/20 text-white" : "bg-amber-500/15 text-amber-500"
              }`}>
                {pendingCount}
              </span>
            )}
          </Button>

          {/* Pages Button */}
          <Button variant="ghost"
            onClick={() => handleNavClick("pages")}
            className={`h-auto flex w-full items-center justify-start gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all cursor-pointer ${
              activeTab === "pages"
                ? "bg-primary text-white shadow-md shadow-primary/25"
                : "text-muted hover:bg-muted-bg hover:text-foreground"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-5 shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <span>Pages</span>
          </Button>

          {/* Sales Section (sales members, managers, admins) */}
          {showSales && (
            <div className="pt-6">
              <Button variant="ghost"
                onClick={() => setIsSalesOpen(!isSalesOpen)}
                className="h-auto flex w-full items-center justify-between px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted hover:text-foreground transition-colors cursor-pointer"
              >
                <span>Sales</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                  stroke="currentColor"
                  className={`size-3 transition-transform ${isSalesOpen ? "rotate-180" : ""}`}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </Button>

              {isSalesOpen && (
                <div className="mt-1 space-y-1 pl-2">
                  <Button variant="ghost"
                    onClick={() => handleNavClick("leads")}
                    className={`h-auto flex w-full items-center justify-start gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition-all cursor-pointer ${
                      activeTab === "leads"
                        ? "bg-primary text-white shadow-md shadow-primary/25"
                        : "text-muted hover:bg-muted-bg hover:text-foreground"
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-4 shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                    </svg>
                    <span>Leads</span>
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Employee Section (ONLY SUPERADMIN CAN VIEW) */}
          {isSuperAdmin && (
            <div className="pt-6">
              <Button variant="ghost"
                onClick={() => setIsEmployeeOpen(!isEmployeeOpen)}
                className="h-auto flex w-full items-center justify-between px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted hover:text-foreground transition-colors cursor-pointer"
              >
                <span>Employee</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                  stroke="currentColor"
                  className={`size-3 transition-transform ${isEmployeeOpen ? "rotate-180" : ""}`}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </Button>

              {isEmployeeOpen && (
                <div className="mt-1 space-y-1 pl-2">
                  <Button variant="ghost"
                    onClick={() => handleNavClick("role-config")}
                    className={`h-auto flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold transition-all cursor-pointer ${
                      activeTab === "role-config"
                        ? "bg-primary text-white shadow-md shadow-primary/25"
                        : "text-muted hover:bg-muted-bg hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-4 shrink-0">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" />
                      </svg>
                      <span>Config</span>
                    </div>
                    <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary-foreground">
                      Super
                    </span>
                  </Button>
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Footer / User Area */}
        <div className="border-t border-border p-4">
          <div className="flex items-center justify-between rounded-xl bg-muted-bg/60 p-3">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                {userEmail ? userEmail[0].toUpperCase() : "A"}
              </div>
              <div className="overflow-hidden">
                <p className="truncate text-xs font-bold text-foreground">{userEmail}</p>
                <p className="text-[10px] font-semibold text-muted">
                  {isSuperAdmin ? "Super Admin" : "Administrator"}
                </p>
              </div>
            </div>
            <ThemeToggle />
          </div>

          <form action={logout} className="mt-3">
            <Button variant="ghost"
              type="submit"
              className="h-auto flex w-full items-center justify-center gap-2 rounded-xl border border-danger/20 bg-danger-bg/40 hover:bg-danger-bg px-3 py-2 text-xs font-bold text-danger transition-all cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
              </svg>
              <span>Log out</span>
            </Button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Mobile Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/85 px-4 backdrop-blur-md lg:hidden">
          <Button variant="ghost"
            onClick={() => setIsMobileOpen(true)}
            className="h-auto rounded-xl border border-border p-2 text-foreground hover:bg-muted-bg"
            aria-label="Open side drawer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </Button>
          <span className="text-sm font-extrabold text-foreground">
            Snapdesk <span className="text-primary">Admin</span>
          </span>
          <ThemeToggle />
        </header>

        {/* Dynamic View Content (Instant 0ms switching) */}
        <main className="flex-1 overflow-y-auto">
          {children ? (
            children
          ) : (
            <>
              <div className={activeTab === "dashboard" ? "block" : "hidden"}>
                {dashboardContent}
              </div>
              <div className={activeTab === "businesses" ? "block" : "hidden"}>
                {businessesContent}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
