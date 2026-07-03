"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
    };
  }
  return {
    name: item.name,
    description: item.description ?? "",
    is_veg: item.is_veg === null ? "na" : item.is_veg ? "veg" : "non-veg",
    has_portions: item.has_portions,
    price_full: String(item.price_full),
    price_half: item.price_half != null ? String(item.price_half) : "",
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

  const set = <K extends keyof ItemInput>(key: K, value: ItemInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {item ? "Save changes" : "Add item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
