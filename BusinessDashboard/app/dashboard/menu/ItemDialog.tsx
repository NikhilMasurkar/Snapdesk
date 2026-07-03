"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ImageUp, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import type { MenuItem } from "@/lib/types";
import { compressAndUpload } from "@/lib/storage";
import { addItem, updateItem, type ItemInput } from "./actions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  categoryId: string | null;
  currency: string;
  /** null = creating a new item */
  item: MenuItem | null;
};

function initialForm(item: MenuItem | null): ItemInput {
  if (!item) {
    return {
      name: "",
      description: "",
      is_veg: "veg",
      has_portions: false,
      price_full: "",
      price_half: "",
      photo_url: "",
    };
  }
  return {
    name: item.name,
    description: item.description ?? "",
    is_veg: item.is_veg === null ? "na" : item.is_veg ? "veg" : "non-veg",
    has_portions: item.has_portions,
    price_full: String(item.price_full),
    price_half: item.price_half != null ? String(item.price_half) : "",
    photo_url: item.photo_url ?? "",
  };
}

export default function ItemDialog({
  open,
  onOpenChange,
  businessId,
  categoryId,
  currency,
  item,
}: Props) {
  const [form, setForm] = useState<ItemInput>(() => initialForm(item));
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof ItemInput>(key: K, value: ItemInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Spec: warn (don't block) when Half ≥ Full — usually a typo.
  const halfNotLessThanFull =
    form.has_portions &&
    form.price_half !== "" &&
    form.price_full !== "" &&
    Number(form.price_half) >= Number(form.price_full);

  const handlePhotoFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    // Random file name: works for new items too (no item id yet).
    const path = `${businessId}/items/${crypto.randomUUID()}.webp`;
    const result = await compressAndUpload(file, path);
    setUploading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    set("photo_url", result.url);
  };

  const handleSave = () =>
    startTransition(async () => {
      const result = item
        ? await updateItem(item.id, businessId, categoryId, form)
        : await addItem(businessId, categoryId, form);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(item ? "Item updated" : "Item added");
      onOpenChange(false);
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? "Edit item" : "Add item"}</DialogTitle>
          <DialogDescription>
            {item
              ? "Update the details customers see on your menu."
              : "New items appear on your live menu immediately."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="item-name">Name</Label>
            <Input
              id="item-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Paneer Tikka"
              autoFocus
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="item-desc">Description (optional)</Label>
            <Textarea
              id="item-desc"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Short description shown under the name"
              rows={2}
            />
          </div>

          <div className="grid gap-2">
            <Label>Photo (optional)</Label>
            <div className="flex items-center gap-3">
              {form.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.photo_url}
                  alt="Item photo preview"
                  className="size-14 rounded-lg border object-cover"
                />
              ) : (
                <div className="flex size-14 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                  <ImageUp className="size-5" />
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploading}
                    onClick={() => photoInputRef.current?.click()}
                  >
                    {uploading ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <ImageUp className="size-3.5" />
                    )}
                    {uploading ? "Uploading…" : form.photo_url ? "Replace" : "Upload"}
                  </Button>
                  {form.photo_url && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => set("photo_url", "")}
                    >
                      <Trash2 className="size-3.5" /> Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Compressed automatically (WebP, under 100KB).
                </p>
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  handlePhotoFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Dietary tag</Label>
            <Select
              value={form.is_veg}
              onValueChange={(v) => set("is_veg", v as ItemInput["is_veg"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="veg">Veg</SelectItem>
                <SelectItem value="non-veg">Non-veg</SelectItem>
                <SelectItem value="na">Not applicable</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="item-portions">Half / Full portions</Label>
              <p className="text-xs text-muted-foreground">
                Customers choose a portion when ordering.
              </p>
            </div>
            <Switch
              id="item-portions"
              checked={form.has_portions}
              onCheckedChange={(v) => set("has_portions", v)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {form.has_portions && (
              <div className="grid gap-2">
                <Label htmlFor="item-half">Half price ({currency})</Label>
                <Input
                  id="item-half"
                  type="number"
                  min="0"
                  value={form.price_half}
                  onChange={(e) => set("price_half", e.target.value)}
                  placeholder="140"
                />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="item-full">
                {form.has_portions ? `Full price (${currency})` : `Price (${currency})`}
              </Label>
              <Input
                id="item-full"
                type="number"
                min="0"
                value={form.price_full}
                onChange={(e) => set("price_full", e.target.value)}
                placeholder="260"
              />
            </div>
          </div>

          {halfNotLessThanFull && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
              ⚠ Half price is usually less than Full price — double-check before saving.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending || uploading}>
            {pending && <Loader2 className="animate-spin" />}
            {item ? "Save changes" : "Add item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
