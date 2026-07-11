"use client";

import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { GripVertical, ImageIcon, Pencil, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
  reorderCategories,
  reorderItems,
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

  // Drag reorder flips instantly in the UI; revalidated server order reconciles.
  const [optimisticCategories, applyCategoryOrder] = useOptimistic(
    categories,
    (state, orderedIds: string[]) => {
      const byId = new Map(state.map((c) => [c.id, c]));
      return orderedIds.map((id) => byId.get(id)).filter((c): c is Category => !!c);
    }
  );

  // Availability toggles and item reorders, same optimistic treatment.
  type ItemPatch =
    | { type: "availability"; id: string; is_available: boolean }
    | { type: "reorder"; orderedIds: string[] };
  const [optimisticItems, applyItemPatch] = useOptimistic(
    items,
    (state, patch: ItemPatch) => {
      if (patch.type === "availability") {
        return state.map((i) =>
          i.id === patch.id ? { ...i, is_available: patch.is_available } : i
        );
      }
      const pos = new Map(patch.orderedIds.map((id, i) => [id, i]));
      const rest = state.filter((i) => !pos.has(i.id));
      const moved = state
        .filter((i) => pos.has(i.id))
        .sort((a, b) => pos.get(a.id)! - pos.get(b.id)!);
      return [...rest, ...moved];
    }
  );

  // Distance/delay constraints keep taps working: a plain tap still hits
  // buttons and switches; only a deliberate drag on the handle starts sorting.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const run = (action: () => Promise<ActionResult>, successMessage?: string) =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok) toast.error(result.error);
      else if (successMessage) toast.success(successMessage);
    });

  const handleToggle = (item: MenuItem, checked: boolean) =>
    startTransition(async () => {
      applyItemPatch({ type: "availability", id: item.id, is_available: checked });
      const result = await toggleAvailability(item.id, checked);
      if (!result.ok) toast.error(result.error);
    });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Category card dragged?
    const fromCat = optimisticCategories.findIndex((c) => c.id === active.id);
    if (fromCat !== -1) {
      const toCat = optimisticCategories.findIndex((c) => c.id === over.id);
      if (toCat === -1) return;
      const orderedIds = arrayMove(optimisticCategories, fromCat, toCat).map((c) => c.id);
      startTransition(async () => {
        applyCategoryOrder(orderedIds);
        const result = await reorderCategories(orderedIds);
        if (!result.ok) toast.error(result.error);
      });
      return;
    }

    // Item dragged — reorder within its own category only.
    const activeItem = optimisticItems.find((i) => i.id === active.id);
    const overItem = optimisticItems.find((i) => i.id === over.id);
    if (!activeItem || !overItem) return;
    if (activeItem.category_id !== overItem.category_id) return;

    const catItems = optimisticItems.filter(
      (i) => i.category_id === activeItem.category_id
    );
    const orderedIds = arrayMove(
      catItems,
      catItems.findIndex((i) => i.id === active.id),
      catItems.findIndex((i) => i.id === over.id)
    ).map((i) => i.id);
    startTransition(async () => {
      applyItemPatch({ type: "reorder", orderedIds });
      const result = await reorderItems(orderedIds);
      if (!result.ok) toast.error(result.error);
    });
  };

  const uncategorized = optimisticItems.filter(
    (i) => !optimisticCategories.some((c) => c.id === i.category_id)
  );

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Menu</h1>
          <p className="text-sm text-muted-foreground">
            Changes appear on your live menu immediately. Drag ⠿ to reorder.
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

      {optimisticCategories.length === 0 && uncategorized.length === 0 && (
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

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={optimisticCategories.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {optimisticCategories.map((category) => (
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
        </SortableContext>

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
      </DndContext>

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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: category?.id ?? "__uncategorized__", disabled: !category });

  return (
    <Card
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "shadow-sm border border-muted/50 overflow-hidden hover:shadow-md transition-all duration-200",
        isDragging && "z-10 opacity-90 shadow-lg ring-2 ring-primary/30"
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 bg-muted/20 border-b py-3 px-5">
        <div className="flex items-center gap-2">
          {category && (
            <button
              {...attributes}
              {...listeners}
              aria-label={`Reorder ${category.name}`}
              className="cursor-grab touch-none text-muted-foreground/60 hover:text-foreground active:cursor-grabbing"
            >
              <GripVertical className="size-4" />
            </button>
          )}
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
          <SortableContext
            items={items.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="divide-y divide-muted/50 bg-background">
              {items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  currency={currency}
                  onEdit={() => onEditItem(item)}
                  onDelete={() => onDeleteItem(item)}
                  onToggle={onToggle}
                />
              ))}
            </div>
          </SortableContext>
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

function ItemRow({
  item,
  currency,
  onEdit,
  onDelete,
  onToggle,
}: {
  item: MenuItem;
  currency: string;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (item: MenuItem, checked: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-3 py-3 px-4 transition-colors duration-150 bg-background",
        item.is_available ? "hover:bg-muted/5" : "bg-muted/10 opacity-75",
        isDragging && "z-10 relative opacity-90 shadow-md ring-1 ring-primary/30 rounded-md"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${item.name}`}
        className="cursor-grab touch-none text-muted-foreground/50 hover:text-foreground active:cursor-grabbing shrink-0"
      >
        <GripVertical className="size-4" />
      </button>
      {item.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.photo_url}
          alt=""
          className="size-9 shrink-0 rounded-md border object-cover select-none"
        />
      ) : (
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-dashed text-muted-foreground/40 select-none">
          <ImageIcon className="size-4" />
        </div>
      )}
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
          onClick={onEdit}
          aria-label={`Edit ${item.name}`}
          className="size-7 hover:bg-muted-foreground/10"
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onDelete}
          aria-label={`Delete ${item.name}`}
          className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
