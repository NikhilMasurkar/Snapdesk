"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Page } from "@/lib/types";
import { createPage, deletePage, updatePage, type PageInput } from "../../actions";
import DialogModal from "../../_components/DialogModal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function PageEditor({ page }: { page: Page | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [editorTab, setEditorTab] = useState<"write" | "preview">("write");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [form, setForm] = useState<PageInput>({
    slug: page?.slug ?? "",
    title: page?.title ?? "",
    content: page?.content ?? "",
    is_published: page?.is_published ?? false,
  });

  const set =
    <K extends keyof PageInput>(k: K) =>
    (v: PageInput[K]) =>
      setForm((p) => ({ ...p, [k]: v }));

  const save = () => {
    setMsg(null);
    startTransition(async () => {
      if (page) {
        const res = await updatePage(page.id, form);
        setMsg(res.ok ? { ok: true, text: "Page changes saved successfully" } : { ok: false, text: res.error });
      } else {
        const res = await createPage(form);
        if (res.ok) router.push(`/pages/${res.id}`);
        else setMsg({ ok: false, text: res.error });
      }
    });
  };

  const remove = () => {
    if (!page) return;
    setIsDeleteModalOpen(false);
    startTransition(async () => {
      const res = await deletePage(page.id);
      if (res.ok) router.push("/pages");
      else setMsg({ ok: false, text: res.error });
    });
  };

  // Simple, elegant hand-rolled inline markdown parser
  const parseInlineMarkdown = (text: string): React.ReactNode[] => {
    const elements: React.ReactNode[] = [];
    let currentText = text;
    let keyIdx = 0;

    while (currentText.length > 0) {
      const boldMatch = currentText.match(/\*\*(.*?)\*\*/);
      const linkMatch = currentText.match(/\[(.*?)\]\((.*?)\)/);

      const boldIndex = boldMatch ? currentText.indexOf(boldMatch[0]) : -1;
      const linkIndex = linkMatch ? currentText.indexOf(linkMatch[0]) : -1;

      // No matches, just append the remaining text
      if (boldIndex === -1 && linkIndex === -1) {
        elements.push(<span key={keyIdx++}>{currentText}</span>);
        break;
      }

      // Check which match comes first
      const isBoldFirst = boldIndex !== -1 && (linkIndex === -1 || boldIndex < linkIndex);

      if (isBoldFirst && boldMatch) {
        // Append text before bold
        if (boldIndex > 0) {
          elements.push(<span key={keyIdx++}>{currentText.slice(0, boldIndex)}</span>);
        }
        // Append bold element
        elements.push(<strong key={keyIdx++} className="font-extrabold text-foreground">{boldMatch[1]}</strong>);
        currentText = currentText.slice(boldIndex + boldMatch[0].length);
      } else if (linkMatch) {
        // Append text before link
        if (linkIndex > 0) {
          elements.push(<span key={keyIdx++}>{currentText.slice(0, linkIndex)}</span>);
        }
        // Append anchor element
        elements.push(
          <a
            key={keyIdx++}
            href={linkMatch[2]}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline hover:text-primary-hover font-semibold"
          >
            {linkMatch[1]}
          </a>
        );
        currentText = currentText.slice(linkIndex + linkMatch[0].length);
      }
    }

    return elements;
  };

  // Simple, elegant block-level markdown parser
  const renderMarkdownPreview = (md: string) => {
    if (!md.trim()) {
      return (
        <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border/80 bg-card/30">
          <p className="text-xs text-muted">Nothing to preview yet. Write some markdown content first.</p>
        </div>
      );
    }

    const lines = md.split("\n");
    let inList = false;
    const renderedBlocks: React.ReactNode[] = [];
    let listItems: React.ReactNode[] = [];
    let listKeyIdx = 0;

    lines.forEach((line, idx) => {
      const trimmed = line.trim();

      // Close list block if needed
      if (!trimmed.startsWith("- ") && inList) {
        renderedBlocks.push(
          <ul key={`ul-${idx}`} className="list-disc ml-5 my-3 space-y-1">
            {listItems}
          </ul>
        );
        listItems = [];
        inList = false;
      }

      // Headers
      if (trimmed.startsWith("### ")) {
        renderedBlocks.push(
          <h4 key={idx} className="text-sm font-bold text-foreground mt-4 mb-2">
            {parseInlineMarkdown(trimmed.slice(4))}
          </h4>
        );
      } else if (trimmed.startsWith("## ")) {
        renderedBlocks.push(
          <h3 key={idx} className="text-base font-bold text-foreground mt-5 mb-2.5 border-b border-border/40 pb-1">
            {parseInlineMarkdown(trimmed.slice(3))}
          </h3>
        );
      } else if (trimmed.startsWith("# ")) {
        renderedBlocks.push(
          <h2 key={idx} className="text-xl font-extrabold text-foreground mt-7 mb-4 border-b border-border pb-1.5">
            {parseInlineMarkdown(trimmed.slice(2))}
          </h2>
        );
      } else if (trimmed.startsWith("- ")) {
        inList = true;
        listItems.push(
          <li key={`li-${listKeyIdx++}`} className="text-xs text-muted pl-1">
            {parseInlineMarkdown(trimmed.slice(2))}
          </li>
        );
      } else if (trimmed === "") {
        // Empty paragraph spacing
        renderedBlocks.push(<div key={`spacer-${idx}`} className="h-3" />);
      } else {
        // Plain paragraph
        renderedBlocks.push(
          <p key={idx} className="text-xs text-muted leading-relaxed my-2">
            {parseInlineMarkdown(trimmed)}
          </p>
        );
      }
    });

    // Close remaining list block if file ends
    if (inList) {
      renderedBlocks.push(
        <ul key="ul-end" className="list-disc ml-5 my-3 space-y-1">
          {listItems}
        </ul>
      );
    }

    return <div className="prose prose-sm max-w-none">{renderedBlocks}</div>;
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {msg && (
        <div
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm animate-fade-in ${
            msg.ok
              ? "bg-success-bg border-success/20 text-success"
              : "bg-danger-bg border-danger/20 text-danger"
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="size-5 shrink-0"
          >
            {msg.ok ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            )}
          </svg>
          <p className="font-semibold">{msg.text}</p>
        </div>
      )}

      {/* Editor top configurations */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Page Title</span>
            <Input
              value={form.title}
              onChange={(e) => set("title")(e.target.value)}
              placeholder="e.g. Privacy Policy"
              className="w-full rounded-xl text-xs font-semibold"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Slug (URL Route PATH)</span>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted pointer-events-none font-mono text-xs">
                /p/
              </span>
              <Input
                value={form.slug}
                onChange={(e) => set("slug")(e.target.value.toLowerCase())}
                placeholder="e.g. privacy"
                className="w-full rounded-xl pl-8 pr-4 font-mono text-xs"
              />
            </div>
          </label>
        </div>
      </div>

      {/* Split/Tabbed writing box */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm flex flex-col">
        {/* Editor controls / tab selectors */}
        <div className="flex items-center justify-between border-b border-border bg-muted-bg/30 px-4 py-2">
          <div className="flex gap-2">
            <Button variant="ghost"
              onClick={() => setEditorTab("write")}
              className={`h-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                editorTab === "write"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.83 20.013a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
              </svg>
              Write Content
            </Button>
            <Button variant="ghost"
              onClick={() => setEditorTab("preview")}
              className={`h-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                editorTab === "preview"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.43 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
              Live Preview
            </Button>
          </div>
          <span className="text-[10px] text-muted font-bold tracking-wide uppercase">Markdown Enabled</span>
        </div>

        {/* Text area and rendered markdown preview */}
        <div className="p-5">
          {editorTab === "write" ? (
            <Textarea
              value={form.content}
              onChange={(e) => set("content")(e.target.value)}
              rows={18}
              placeholder={"# Title\n\nWrite your content using markdown syntax...\n\n## Subheading\n\n- Bullet items\n- **Bold text** or [Link anchor](https://google.com)"}
              className="w-full rounded-xl bg-background p-4 font-mono text-xs resize-y"
            />
          ) : (
            <div className="h-auto rounded-xl border border-border bg-background p-6 overflow-y-auto max-h-[400px]">
              {renderMarkdownPreview(form.content)}
            </div>
          )}
        </div>
      </div>

      {/* Publication and actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-border bg-card p-5 shadow-sm">
        <label className="flex items-center gap-3 cursor-pointer group">
          <Checkbox
            checked={form.is_published}
            onCheckedChange={(v) => set("is_published")(v === true)}
            className="size-4 cursor-pointer"
          />
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-foreground group-hover:text-success transition-colors">Publish immediately</span>
            <span className="text-[10px] text-muted">Toggle visibility to display this page on the public menu site registry.</span>
          </div>
        </label>

        <div className="flex items-center gap-2 self-end sm:self-center">
          {page && (
            <Button variant="ghost"
              disabled={pending}
              onClick={() => setIsDeleteModalOpen(true)}
              className="h-auto rounded-xl border border-danger/30 hover:border-danger bg-card hover:bg-danger-bg px-4 py-2.5 text-xs font-bold text-danger transition-all cursor-pointer disabled:opacity-50"
            >
              Delete Page
            </Button>
          )}
          <Button variant="ghost"
            disabled={pending}
            onClick={save}
            className="h-auto rounded-xl bg-primary hover:bg-primary-hover px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-sm hover:shadow-primary/20 transition-all cursor-pointer disabled:opacity-50"
          >
            {pending ? "Saving..." : page ? "Save Changes" : "Create Page"}
          </Button>
        </div>
      </div>

      <p className="text-[10px] text-muted leading-relaxed italic text-center">
        Supported Markdown formats: <span className="font-semibold text-foreground"># Header 1</span>, <span className="font-semibold text-foreground">## Header 2</span>, <span className="font-semibold text-foreground">### Header 3</span>, <span className="font-semibold text-foreground">- List items</span>, <span className="font-semibold text-foreground">**Bold Text**</span>, and <span className="font-semibold text-foreground">[Link Title](URL)</span>.
      </p>

      {/* Custom Page Delete Confirmation Dialog */}
      <DialogModal
        isOpen={isDeleteModalOpen}
        title="Delete Content Page?"
        message={`Are you sure you want to permanently delete "${form.title}"? This will remove the URL route /p/${form.slug} immediately and is audited.`}
        type="confirm"
        okLabel="Delete Page"
        isDestructive={true}
        onConfirm={remove}
        onCancel={() => setIsDeleteModalOpen(false)}
      />
    </div>
  );
}
