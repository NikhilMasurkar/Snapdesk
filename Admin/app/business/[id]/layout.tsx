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

  return (
    <main className="min-h-screen bg-background text-foreground transition-colors duration-200 pb-16">
      <header className="sticky top-0 z-10 border-b border-border bg-card/85 backdrop-blur-md">
        <div className="flex w-full items-center justify-between px-6 py-4 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-muted hover:text-foreground transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="size-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
              Admin Portal
            </Link>
            <div className="h-6 w-px bg-border" />
            <div>
              <h1 className="text-base font-bold tracking-tight text-foreground">{business.name}</h1>
              <p className="text-[10px] font-bold text-muted uppercase tracking-wider">
                {business.status} · {business.plan} ·{" "}
                <a
                  href={`${MENU_BASE_URL}/m/${business.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline font-semibold"
                >
                  /m/{business.slug}
                </a>
              </p>
            </div>
          </div>
        </div>
        <TabNav id={id} />
      </header>

      <div className="flex w-full flex-col gap-6 px-6 py-8 lg:px-8">{children}</div>
    </main>
  );
}
