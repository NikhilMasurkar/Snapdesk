import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdmin } from "@/lib/admin";
import { getBusiness } from "@/lib/business";
import TabNav from "./TabNav";

const MENU_BASE_URL =
  process.env.NEXT_PUBLIC_MENU_BASE_URL ?? "https://snapdesk-tan.vercel.app";

export default async function BusinessLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  const { isAdmin } = await getAdmin();
  if (!isAdmin) notFound(); // don't reveal the panel exists

  const business = await getBusiness(id);
  if (!business) notFound();

  const getStatusColor = (st: string) => {
    switch (st) {
      case "approved":
        return "bg-success-bg border-success/30 text-success";
      case "suspended":
        return "bg-danger-bg border-danger/30 text-danger";
      case "rejected":
        return "bg-muted-bg border-border text-muted";
      default:
        return "bg-warning-bg border-warning/30 text-warning";
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground transition-colors duration-200 pb-16">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 shadow-xs">
        <div className="flex flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              href="/?tab=businesses"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-muted hover:text-foreground hover:border-primary/40 transition-all shadow-2xs"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="size-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
              Businesses
            </Link>

            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary font-black text-lg border border-primary/20 shadow-2xs">
                {business.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-extrabold tracking-tight text-foreground">{business.name}</h1>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${getStatusColor(business.status)}`}>
                    {business.status}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-muted-bg border border-border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-muted">
                    {business.plan} Plan
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                  <span>Slug: <strong className="font-semibold text-foreground">{business.slug}</strong></span>
                  <span>·</span>
                  <a
                    href={`${MENU_BASE_URL}/m/${business.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline font-bold"
                  >
                    View Live Menu
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
        <TabNav id={id} />
      </header>

      <div className="flex w-full flex-col gap-6 px-6 py-8 lg:px-8">{children}</div>
    </main>
  );
}
