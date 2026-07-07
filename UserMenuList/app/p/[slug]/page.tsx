import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { getSupabase } from "@/lib/supabase";

type PageProps = { params: Promise<{ slug: string }> };

type CmsPage = {
  title: string;
  content: string;
  updated_at: string;
};

async function fetchPage(slug: string): Promise<CmsPage | null> {
  const supabase = getSupabase();
  // RLS ("public read published pages") only returns published rows to anon.
  const { data } = await supabase
    .from("pages")
    .select("title, content, updated_at")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  return (data as CmsPage) ?? null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await fetchPage(slug);
  return { title: page ? `${page.title} · Snapdesk` : "Page not found" };
}

export default async function ContentPage({ params }: PageProps) {
  const { slug } = await params;
  const page = await fetchPage(slug);
  if (!page) notFound();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col bg-white px-5 py-8 shadow-sm">
      <h1 className="text-2xl font-bold tracking-tight">{page.title}</h1>
      <p className="mt-1 text-xs text-zinc-400">
        Last updated {new Date(page.updated_at).toLocaleDateString()}
      </p>
      <article className="prose-snapdesk mt-6 text-sm leading-relaxed text-zinc-700">
        <ReactMarkdown>{page.content}</ReactMarkdown>
      </article>
      <Link
        href="/"
        className="mt-10 text-sm font-medium text-zinc-900 underline"
      >
        ← Back
      </Link>
    </div>
  );
}
