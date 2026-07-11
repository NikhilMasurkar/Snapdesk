import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/service";
import { canSalesMember, isSuperAdmin } from "@/lib/roles";
import type { Page } from "@/lib/types";
import AdminShell from "../_components/AdminShell";

const MENU_BASE_URL =
  process.env.NEXT_PUBLIC_MENU_BASE_URL ?? "https://snapdesk-tan.vercel.app";

export default async function PagesListPage() {
  const { user, isAdmin, roles } = await getAdmin();
  if (!isAdmin) notFound();

  const service = createServiceClient();
  const { data } = await service
    .from("pages")
    .select("*")
    .order("updated_at", { ascending: false });
  const pages = (data ?? []) as Page[];

  return (
    <AdminShell
      userEmail={user.email ?? ""}
      isSuperAdmin={isSuperAdmin(roles)}
      showSales={canSalesMember(roles)}
      initialTab="pages"
    >
      <div className="flex w-full flex-col px-6 py-8 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Content Pages</h1>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              Create and edit content pages (e.g. privacy policies, terms of service, about sections) for your public menu site.
            </p>
          </div>
          <Link
            href="/pages/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary hover:bg-primary-hover px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-sm hover:shadow-primary/20 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="size-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Page
          </Link>
        </div>

        {pages.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-12 px-4 text-center bg-card/30">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="size-10 text-muted mb-3"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
              />
            </svg>
            <h3 className="text-sm font-bold text-foreground">No custom pages found</h3>
            <p className="mt-1 text-xs text-muted max-w-xs mb-4">Create your first public content or compliance page to get started.</p>
            <Link
              href="/pages/new"
              className="inline-flex items-center gap-1 rounded-xl bg-primary hover:bg-primary-hover px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-md transition-all"
            >
              Create Privacy Policy
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {pages.map((p) => (
              <div
                key={p.id}
                className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-all group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                      {p.title}
                    </h3>
                    {p.is_published ? (
                      <span className="inline-flex items-center rounded-full bg-success-bg/60 border border-success/20 px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-success">
                        Published
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-muted-bg border border-border/80 px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-muted">
                        Draft
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-[10px] text-muted mb-4 truncate">
                    /p/{p.slug}
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-border/60 pt-4 mt-2">
                  <span className="text-[10px] text-muted" suppressHydrationWarning>
                    Updated {p.updated_at ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(p.updated_at)) : "N/A"}
                  </span>
                  
                  <div className="flex items-center gap-3">
                    {p.is_published && (
                      <a
                        href={`${MENU_BASE_URL}/p/${p.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-0.5 text-xs font-bold text-muted hover:text-foreground transition-colors"
                      >
                        View
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="size-3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                      </a>
                    )}
                    <Link
                      href={`/pages/${p.id}`}
                      className="text-xs font-bold text-primary hover:text-primary-hover hover:underline"
                    >
                      Edit Content
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
