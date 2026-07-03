"use client";

import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import VegDot from "@/components/dashboard/VegDot";
import type { Category, MenuItem } from "@/lib/types";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  addCategory,
  deleteCategory,
  deleteItem,
  renameCategory,
  toggleAvailability,
} from "./actions";
import ItemDialog from "./ItemDialog";

type Props = {
  businessId: string;
  currency: string;
  categories: Category[];
  items: MenuItem[];
};

type ItemDialogState = { categoryId: string | null; item: MenuItem | null } | null;
type ConfirmState =
  | { kind: "delete-category"; category: Category }
  | { kind: "delete-item"; item: MenuItem }
  | null;

export default function MenuEditor({ businessId, currency, categories, items }: Props) {
  const [, startTransition] = useTransition();
  const [newCategory, setNewCategory] = useState("");
  const [itemDialog, setItemDialog] = useState<ItemDialogState>(null);
  const [renaming, setRenaming] = useState<Category | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  // Availability flips instantly in the UI; the server result reconciles it.
  const [optimisticItems, applyAvailability] = useOptimistic(
    items,
    (state, patch: { id: string; is_available: boolean }) =>
      state.map((i) =>
        i.id === patch.id ? { ...i, is_available: patch.is_available } : i
      )
  );

  const run = (action: () => Promise<ActionResult>, successMessage?: string) =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok) toast.error(result.error);
      else if (successMessage) toast.success(successMessage);
    });

  const handleToggle = (item: MenuItem, checked: boolean) =>
    startTransition(async () => {
      applyAvailability({ id: item.id, is_available: checked });
      const result = await toggleAvailability(item.id, checked);
      if (!result.ok) toast.error(result.error);
    });

  const uncategorized = optimisticItems.filter(
    (i) => !categories.some((c) => c.id === i.category_id)
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Menu</h1>
          <p className="text-sm text-muted-foreground">
            Changes appear on your live menu immediately.
          </p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const name = newCategory;
          setNewCategory("");
          run(() => addCategory(businessId, name), `Added "${name.trim()}"`);
        }}
        className="flex gap-2"
      >
        <Input
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          placeholder="New category, e.g. Starters"
        />
        <Button type="submit" disabled={!newCategory.trim()}>
          <Plus /> Add category
        </Button>
      </form>

      {categories.length === 0 && uncategorized.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <UtensilsCrossed className="size-8 text-muted-foreground" />
            <p className="font-medium">Your menu is empty</p>
            <p className="text-sm text-muted-foreground">
              Add a category above, then add items to it.
            </p>
          </CardContent>
        </Card>
      )}

      {categories.map((category) => (
        <CategoryCard
          key={category.id}
          category={category}
          items={optimisticItems.filter((i) => i.category_id === category.id)}
          currency={currency}
          onAddItem={() => setItemDialog({ categoryId: category.id, item: null })}
          onEditItem={(item) => setItemDialog({ categoryId: category.id, item })}
          onDeleteItem={(item) => setConfirm({ kind: "delete-item", item })}
          onRename={() => {
            setRenaming(category);
            setRenameValue(category.name);
          }}
          onDelete={() => setConfirm({ kind: "delete-category", category })}
          onToggle={handleToggle}
        />
      ))}

      {uncategorized.length > 0 && (
        <CategoryCard
          category={null}
          items={uncategorized}
          currency={currency}
          onAddItem={() => setItemDialog({ categoryId: null, item: null })}
          onEditItem={(item) => setItemDialog({ categoryId: null, item })}
          onDeleteItem={(item) => setConfirm({ kind: "delete-item", item })}
          onToggle={handleToggle}
        />
      )}

      {/* Add / edit item */}
      {itemDialog && (
        <ItemDialog
          key={itemDialog.item?.id ?? `new-${itemDialog.categoryId}`}
          open
          onOpenChange={(open) => !open && setItemDialog(null)}
          businessId={businessId}
          categoryId={itemDialog.categoryId}
          currency={currency}
          item={itemDialog.item}
        />
      )}

      {/* Rename category */}
      <Dialog open={renaming !== null} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename category</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && renaming && renameValue.trim()) {
                run(() => renameCategory(renaming.id, renameValue), "Category renamed");
                setRenaming(null);
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button
              disabled={!renameValue.trim()}
              onClick={() => {
                if (!renaming) return;
                run(() => renameCategory(renaming.id, renameValue), "Category renamed");
                setRenaming(null);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmations */}
      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "delete-category"
                ? `Delete "${confirm.category.name}"?`
                : `Delete "${confirm?.item.name}"?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "delete-category"
                ? "Items in this category move to Uncategorized. This cannot be undone."
                : "This removes the item from your live menu. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (!confirm) return;
                if (confirm.kind === "delete-category") {
                  run(() => deleteCategory(confirm.category.id), "Category deleted");
                } else {
                  run(() => deleteItem(confirm.item.id), "Item deleted");
                }
                setConfirm(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CategoryCard({
  category,
  items,
  currency,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onRename,
  onDelete,
  onToggle,
}: {
  category: Category | null; // null = Uncategorized
  items: MenuItem[];
  currency: string;
  onAddItem: () => void;
  onEditItem: (item: MenuItem) => void;
  onDeleteItem: (item: MenuItem) => void;
  onRename?: () => void;
  onDelete?: () => void;
  onToggle: (item: MenuItem, checked: boolean) => void;
}) {
  return (
    <Card className="shadow-sm border border-muted/50 overflow-hidden hover:shadow-md transition-all duration-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 bg-muted/20 border-b py-3 px-5">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-bold tracking-tight">
            {category?.name ?? <span className="text-muted-foreground italic font-medium">Uncategorized</span>}
          </CardTitle>
          <span className="rounded-full bg-muted-foreground/10 text-muted-foreground text-[10px] font-bold px-2 py-0.5 select-none">
            {items.length} {items.length === 1 ? "item" : "items"}
          </span>
        </div>
        <div className="flex items-center gap-1 select-none">
          {onRename && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onRename}
              aria-label="Rename category"
              className="size-7 hover:bg-muted-foreground/10"
            >
              <Pencil className="size-3.5" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onDelete}
              aria-label="Delete category"
              className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col p-0">
        {items.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground italic bg-background/50">
            No items in this category yet.
          </p>
        ) : (
          <div className="divide-y divide-muted/50 bg-background">
            {items.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-center gap-4 py-3 px-5 transition-colors duration-150",
                  item.is_available ? "hover:bg-muted/5" : "bg-muted/10 opacity-75"
                )}
              >
                <div className="shrink-0 select-none">
                  <VegDot isVeg={item.is_veg} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p
                      className={cn(
                        "truncate text-sm font-semibold tracking-tight text-foreground",
                        !item.is_available && "text-muted-foreground line-through decoration-muted-foreground/60"
                      )}
                    >
                      {item.name}
                    </p>
                    {!item.is_available && (
                      <Badge variant="secondary" className="text-[9px] py-0 px-1.5 uppercase font-semibold select-none">
                        Sold Out
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground/80 mt-0.5">
                    <span className="font-medium text-foreground/80">
                      {item.has_portions
                        ? `Half: ${currency}${item.price_half} · Full: ${currency}${item.price_full}`
                        : `${currency}${item.price_full}`}
                    </span>
                    {item.description ? ` — ${item.description}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 select-none">
                  <div className="flex items-center gap-1.5 mr-2">
                    <span className="text-[10px] text-muted-foreground/85 font-medium hidden sm:inline">
                      {item.is_available ? "Available" : "Hidden"}
                    </span>
                    <Switch
                      checked={item.is_available}
                      onCheckedChange={(checked) => onToggle(item, checked)}
                      aria-label={`${item.name} available`}
                      className="scale-90"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onEditItem(item)}
                    aria-label={`Edit ${item.name}`}
                    className="size-7 hover:bg-muted-foreground/10"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onDeleteItem(item)}
                    aria-label={`Delete ${item.name}`}
                    className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="p-3 bg-muted/10 border-t border-muted/50 flex justify-start select-none">
          <Button
            variant="outline"
            size="sm"
            onClick={onAddItem}
            className="h-8 text-xs font-semibold hover:bg-primary hover:text-primary-foreground transition-all duration-200 border-muted-foreground/20"
          >
            <Plus className="mr-1 size-3" /> Add item
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
