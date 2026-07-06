"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, ImageUp, Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Business } from "@/lib/types";
import { compressAndUpload } from "@/lib/storage";
import { updateBusiness, type BusinessInput } from "./actions";

const CURRENCIES = ["₹", "$", "€", "£", "AED", "Rs"];

const labelClass =
  "text-xs font-bold uppercase tracking-wider text-muted-foreground/80";

export default function SettingsForm({
  business,
  liveMenuUrl,
}: {
  business: Business;
  liveMenuUrl: string;
}) {
  const [pending, startTransition] = useTransition();
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [copied, setCopied] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<BusinessInput>({
    name: business.name,
    tagline: business.tagline ?? "",
    whatsapp_number: business.whatsapp_number,
    menu_label: business.menu_label,
    currency: business.currency ?? "₹",
    logo_url: business.logo_url ?? "",
    accepting_orders: business.accepting_orders ?? true,
    opening_hours: business.opening_hours ?? "",
  });

  const set = <K extends keyof BusinessInput>(key: K, value: BusinessInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSave = () =>
    startTransition(async () => {
      const result = await updateBusiness(business.id, form);
      if (!result.ok) toast.error(result.error);
      else toast.success("Settings saved");
    });

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(liveMenuUrl);
      setCopied(true);
      toast.success("Menu link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — long-press the link instead.");
    }
  };

  // A wrong WhatsApp number silently loses every order — let the owner
  // verify the target phone actually receives messages before going live.
  const testWhatsApp = () => {
    const digits = form.whatsapp_number.replace(/\D/g, "");
    if (digits.length < 10) {
      toast.error("Enter the WhatsApp number first (with country code).");
      return;
    }
    const text = encodeURIComponent(
      "Test from my Snapdesk dashboard — orders will arrive on this number. ✅"
    );
    window.open(`https://wa.me/${digits}?text=${text}`, "_blank");
  };

  const handleLogoFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadingLogo(true);
    const result = await compressAndUpload(file, `${business.id}/logo.webp`);
    setUploadingLogo(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    set("logo_url", result.url);
    toast.success("Logo uploaded — hit Save changes to apply.");
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Public menu link */}
      <Card className="shadow-sm border border-muted/50 overflow-hidden">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className={labelClass}>Your public menu</p>
            <p className="mt-1 truncate font-mono text-sm text-foreground/90">{liveMenuUrl}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyUrl}>
              {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy link"}
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={liveMenuUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-3.5" /> Open
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border border-muted/50 overflow-hidden">
        <CardHeader className="bg-muted/20 border-b py-4 px-6">
          <CardTitle className="text-base font-bold tracking-tight">Business profile</CardTitle>
          <CardDescription className="text-xs">
            Shown on your public menu page at /m/{business.slug}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 p-6">
          <div className="grid gap-2">
            <Label htmlFor="biz-name" className={labelClass}>Business name</Label>
            <Input
              id="biz-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className="bg-background"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="biz-tagline" className={labelClass}>Tagline (optional)</Label>
            <Input
              id="biz-tagline"
              value={form.tagline}
              onChange={(e) => set("tagline", e.target.value)}
              placeholder="e.g. Authentic Indian Cuisine"
              className="bg-background"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="biz-wa" className={labelClass}>WhatsApp number</Label>
            <div className="flex gap-2">
              <Input
                id="biz-wa"
                value={form.whatsapp_number}
                onChange={(e) => set("whatsapp_number", e.target.value)}
                placeholder="919812345678"
                inputMode="numeric"
                className="bg-background"
              />
              <Button
                type="button"
                variant="outline"
                onClick={testWhatsApp}
                className="shrink-0 text-emerald-700 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950"
              >
                <MessageCircle className="size-4" /> Send test
              </Button>
            </div>
            <p className="text-xs text-muted-foreground/80">
              With country code, digits only — orders are sent to this number.
              Use <strong>Send test</strong> to confirm messages reach the right phone.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="biz-label" className={labelClass}>Menu label</Label>
              <Select value={form.menu_label} onValueChange={(v) => set("menu_label", v)}>
                <SelectTrigger id="biz-label" className="bg-background w-full">
                  <SelectValue placeholder="Menu" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Menu">Menu</SelectItem>
                  <SelectItem value="Services">Services</SelectItem>
                  <SelectItem value="Price List">Price List</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="biz-currency" className={labelClass}>Currency</Label>
              <Select value={form.currency} onValueChange={(v) => set("currency", v)}>
                <SelectTrigger id="biz-currency" className="bg-background w-full">
                  <SelectValue placeholder="₹" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label className={labelClass}>Logo (optional)</Label>
            <div className="flex items-center gap-3">
              {form.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.logo_url}
                  alt="Logo preview"
                  className="size-12 rounded-lg border object-cover bg-background"
                />
              ) : (
                <div className="flex size-12 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                  <ImageUp className="size-5" />
                </div>
              )}
              <div className="flex flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingLogo}
                  onClick={() => logoInputRef.current?.click()}
                >
                  {uploadingLogo ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <ImageUp className="size-3.5" />
                  )}
                  {uploadingLogo ? "Uploading…" : "Upload logo"}
                </Button>
                {form.logo_url && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => set("logo_url", "")}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  handleLogoFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground/80">
              Compressed automatically (WebP, under 100KB). Square images look best.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="biz-hours" className={labelClass}>Opening hours (optional)</Label>
            <Input
              id="biz-hours"
              value={form.opening_hours}
              onChange={(e) => set("opening_hours", e.target.value)}
              placeholder="10am–11pm, closed Mon"
              className="bg-background"
            />
            <p className="text-xs text-muted-foreground/80">
              Shown to customers when you stop accepting orders.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-4 transition-all duration-200">
            <div className="space-y-0.5">
              <Label htmlFor="biz-accepting" className="text-sm font-semibold tracking-tight">Accepting orders</Label>
              <p className="text-xs text-muted-foreground/85">
                Turn off when you close — customers can browse the menu but not order.
              </p>
            </div>
            <Switch
              id="biz-accepting"
              checked={form.accepting_orders}
              onCheckedChange={(v) => set("accepting_orders", v)}
              className="scale-90"
            />
          </div>
        </CardContent>
        <CardFooter className="bg-muted/10 border-t py-4 px-6 flex justify-end">
          <Button
            onClick={handleSave}
            disabled={pending || uploadingLogo}
            className="shadow-sm font-semibold px-5"
          >
            {pending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : null}
            Save changes
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
