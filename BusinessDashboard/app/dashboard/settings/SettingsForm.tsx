"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import type { Business } from "@/lib/types";
import { updateBusiness, type BusinessInput } from "./actions";

export default function SettingsForm({ business }: { business: Business }) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<BusinessInput>({
    name: business.name,
    tagline: business.tagline ?? "",
    whatsapp_number: business.whatsapp_number,
    menu_label: business.menu_label,
    logo_url: business.logo_url ?? "",
    is_active: business.is_active,
  });

  const set = <K extends keyof BusinessInput>(key: K, value: BusinessInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSave = () =>
    startTransition(async () => {
      const result = await updateBusiness(business.id, form);
      if (!result.ok) toast.error(result.error);
      else toast.success("Settings saved");
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Business profile</CardTitle>
        <CardDescription>
          Shown on your public menu page at /m/{business.slug}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="biz-name">Business name</Label>
          <Input
            id="biz-name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="biz-tagline">Tagline (optional)</Label>
          <Input
            id="biz-tagline"
            value={form.tagline}
            onChange={(e) => set("tagline", e.target.value)}
            placeholder="e.g. Authentic Indian Cuisine"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="biz-wa">WhatsApp number</Label>
          <Input
            id="biz-wa"
            value={form.whatsapp_number}
            onChange={(e) => set("whatsapp_number", e.target.value)}
            placeholder="919812345678"
            inputMode="numeric"
          />
          <p className="text-xs text-muted-foreground">
            With country code, digits only — orders are sent to this number.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="biz-label">Menu label</Label>
            <Input
              id="biz-label"
              value={form.menu_label}
              onChange={(e) => set("menu_label", e.target.value)}
              placeholder="Menu / Services / Price List"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="biz-logo">Logo URL (optional)</Label>
            <Input
              id="biz-logo"
              value={form.logo_url}
              onChange={(e) => set("logo_url", e.target.value)}
              placeholder="https://…"
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label htmlFor="biz-active">Menu is live</Label>
            <p className="text-xs text-muted-foreground">
              Turning this off shows customers &quot;menu not available&quot;.
            </p>
          </div>
          <Switch
            id="biz-active"
            checked={form.is_active}
            onCheckedChange={(v) => set("is_active", v)}
          />
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Save changes
        </Button>
      </CardFooter>
    </Card>
  );
}
