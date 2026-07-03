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
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">
          {category?.name ?? <span className="text-muted-foreground">Uncategorized</span>}
        </CardTitle>
        <div className="flex items-center gap-1">
          {onRename && (
            <Button variant="ghost" size="icon-sm" onClick={onRename} aria-label="Rename category">
              <Pencil />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onDelete}
              aria-label="Delete category"
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col">
        {items.length === 0 && (
          <p className="py-2 text-sm text-muted-foreground">No items yet.</p>
        )}
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 border-b py-3 last:border-0"
          >
            <VegDot isVeg={item.is_veg} />
            <div className="min-w-0 flex-1">
              <p className={`truncate text-sm font-medium ${item.is_available ? "" : "text-muted-foreground line-through"}`}>
                {item.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {item.has_portions
                  ? `Half ${currency}${item.price_half} · Full ${currency}${item.price_full}`
                  : `${currency}${item.price_full}`}
                {item.description ? ` — ${item.description}` : ""}
              </p>
            </div>
            <Switch
              checked={item.is_available}
              onCheckedChange={(checked) => onToggle(item, checked)}
              aria-label={`${item.name} available`}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onEditItem(item)}
              aria-label={`Edit ${item.name}`}
            >
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onDeleteItem(item)}
              aria-label={`Delete ${item.name}`}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={onAddItem} className="mt-3 self-start">
          <Plus /> Add item
        </Button>
      </CardContent>
    </Card>
  );
}
