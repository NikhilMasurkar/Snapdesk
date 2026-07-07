import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/service";
import type { Page } from "@/lib/types";
import PageEditor from "./PageEditor";

export default async function PageEditRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { isAdmin } = await getAdmin();
  if (!isAdmin) notFound();

  let page: Page | null = null;
  if (id !== "new") {
    const service = createServiceClient();
    const { data } = await service.from("pages").select("*").eq("id", id).maybeSingle();
    if (!data) notFound();
    page = data as Page;
  }

  return (
    <main className="min-h-screen bg-background text-foreground transition-colors duration-200 pb-16">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-card/85 backdrop-blur-md">
        <div className="flex w-full items-center gap-4 px-6 py-4 lg:px-8">
          <Link
            href="/pages"
            className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-muted hover:text-foreground transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="size-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Pages
          </Link>
          <div className="h-6 w-px bg-border" />
          <h1 className="text-base font-bold tracking-tight text-foreground">
            {page ? `Edit: ${page.title}` : "New Page"}
          </h1>
        </div>
      </header>

      <div className="flex w-full flex-col px-6 py-8 lg:px-8">
        <PageEditor page={page} />
      </div>
    </main>
  );
}
