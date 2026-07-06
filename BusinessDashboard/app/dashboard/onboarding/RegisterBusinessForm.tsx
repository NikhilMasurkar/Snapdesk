"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Store } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { SUPPORT_EMAIL } from "@/lib/config";
import { submitApplication, type ApplicationInput } from "./actions";

const sectionClass =
  "text-xs font-bold uppercase tracking-wider text-muted-foreground";

export default function RegisterBusinessForm({ email }: { email: string }) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<ApplicationInput>({
    name: "",
    type: "restaurant",
    tagline: "",
    whatsapp_number: "",
    opening_hours: "",
    address: "",
    city: "",
    pincode: "",
    owner_name: "",
    owner_phone: "",
    gst_number: "",
  });

  const set = <K extends keyof ApplicationInput>(key: K, value: ApplicationInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await submitApplication(form);
      if (!result.ok) toast.error(result.error);
      // On success the layout revalidates into the "under review" screen.
    });
  };

  return (
    <Card className="w-full max-w-lg shadow-sm">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Store className="size-6" />
        </div>
        <CardTitle className="text-xl font-bold tracking-tight">
          Apply to join Snapdesk
        </CardTitle>
        <CardDescription>
          Signed in as <strong>{email}</strong>. We review every application
          personally — you&apos;ll get dashboard access once approved.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="grid gap-4">
          <p className={sectionClass}>Business</p>
          <div className="grid gap-2">
            <Label htmlFor="app-name">Business name *</Label>
            <Input id="app-name" value={form.name} required autoFocus
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Spice Garden Kitchen" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="app-type">Type *</Label>
              <Select value={form.type}
                onValueChange={(v) => set("type", v as ApplicationInput["type"])}>
                <SelectTrigger id="app-type" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="restaurant">Restaurant / Café</SelectItem>
                  <SelectItem value="parlour">Salon / Parlour</SelectItem>
                  <SelectItem value="bakery">Bakery</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="app-wa">WhatsApp number *</Label>
              <Input id="app-wa" value={form.whatsapp_number} required inputMode="numeric"
                onChange={(e) => set("whatsapp_number", e.target.value)}
                placeholder="919812345678" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="app-tagline">Tagline</Label>
              <Input id="app-tagline" value={form.tagline}
                onChange={(e) => set("tagline", e.target.value)}
                placeholder="e.g. Authentic Indian Cuisine" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="app-hours">Opening hours</Label>
              <Input id="app-hours" value={form.opening_hours}
                onChange={(e) => set("opening_hours", e.target.value)}
                placeholder="10am–11pm, closed Mon" />
            </div>
          </div>

          <Separator />
          <p className={sectionClass}>Location</p>
          <div className="grid gap-2">
            <Label htmlFor="app-address">Address *</Label>
            <Input id="app-address" value={form.address} required
              onChange={(e) => set("address", e.target.value)}
              placeholder="Shop no, street, landmark" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="app-city">City *</Label>
              <Input id="app-city" value={form.city} required
                onChange={(e) => set("city", e.target.value)} placeholder="Pune" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="app-pincode">Pincode *</Label>
              <Input id="app-pincode" value={form.pincode} required inputMode="numeric"
                onChange={(e) => set("pincode", e.target.value)} placeholder="411001" />
            </div>
          </div>

          <Separator />
          <p className={sectionClass}>Owner</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="app-owner">Full name *</Label>
              <Input id="app-owner" value={form.owner_name} required
                onChange={(e) => set("owner_name", e.target.value)} placeholder="Your name" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="app-phone">Phone *</Label>
              <Input id="app-phone" value={form.owner_phone} required inputMode="numeric"
                onChange={(e) => set("owner_phone", e.target.value)} placeholder="9812345678" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="app-gst">GST number (optional)</Label>
            <Input id="app-gst" value={form.gst_number}
              onChange={(e) => set("gst_number", e.target.value)} placeholder="22AAAAA0000A1Z5" />
          </div>

          <p className="text-xs text-muted-foreground">
            By applying you agree to be contacted about your application.
            Questions: <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </p>
        </CardContent>
        <CardFooter className="pt-6">
          <Button type="submit" disabled={pending} className="w-full font-semibold">
            {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Submit application
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
