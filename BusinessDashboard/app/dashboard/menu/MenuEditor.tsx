"use client";

import { useState, useTransition } from "react";
import type { Category, MenuItem } from "@/lib/types";
import {
  addCategory,
  addItem,
  deleteCategory,
  deleteItem,
  renameCategory,
  toggleAvailability,
  updateItem,
  type ItemInput,
} from "./actions";

type Props = {
  businessId: string;
  currency: string;
  categories: Category[];
  items: MenuItem[];
};

const emptyItem: ItemInput = {
  name: "",
  description: "",
  is_veg: "veg",
  has_portions: false,
  price_full: "",
  price_half: "",
};

export default function MenuEditor({ businessId, currency, categories, items }: Props) {
  const [pending, startTransition] = useTransition();
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<{ id: string | "new"; categoryId: string | null } | null>(null);

  const uncategorized = items.filter((i) => !categories.some((c) => c.id === i.category_id));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Menu</h1>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const name = newCategoryName;
          setNewCategoryName("");
          startTransition(() => addCategory(businessId, name));
        }}
        className="mb-6 flex gap-2"
      >
        <input
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          placeholder="New category name (e.g. Starters)"
          className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
        />
        <button
          type="submit"
          disabled={!newCategoryName.trim() || pending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Add category
        </button>
      </form>

      <div className="flex flex-col gap-8">
        {categories.map((category) => (
          <div key={category.id}>
            <div className="mb-2 flex items-center gap-2">
              {editingCategory === category.id ? (
                <input
                  defaultValue={category.name}
                  autoFocus
                  onBlur={(e) => {
                    startTransition(() => renameCategory(category.id, e.target.value));
                    setEditingCategory(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setEditingCategory(null);
                  }}
                  className="rounded border border-zinc-300 px-2 py-1 text-base font-bold"
                />
              ) : (
                <h2
                  onClick={() => setEditingCategory(category.id)}
                  className="cursor-pointer text-base font-bold hover:underline"
                  title="Click to rename"
                >
                  {category.name}
                </h2>
              )}
              <button
                onClick={() => {
                  if (confirm(`Delete "${category.name}"? Items move to Uncategorized.`)) {
                    startTransition(() => deleteCategory(category.id));
                  }
                }}
                className="ml-auto text-xs font-medium text-red-500"
              >
                Delete category
              </button>
            </div>

            <ItemList
              items={items.filter((i) => i.category_id === category.id)}
              currency={currency}
              editingItem={editingItem}
              setEditingItem={setEditingItem}
              categoryId={category.id}
              businessId={businessId}
              startTransition={startTransition}
            />
          </div>
        ))}

        {uncategorized.length > 0 && (
          <div>
            <h2 className="mb-2 text-base font-bold text-zinc-500">Uncategorized</h2>
            <ItemList
              items={uncategorized}
              currency={currency}
              editingItem={editingItem}
              setEditingItem={setEditingItem}
              categoryId={null}
              businessId={businessId}
              startTransition={startTransition}
            />
          </div>
        )}

        {categories.length === 0 && (
          <p className="text-sm text-zinc-500">Add a category above to start building your menu.</p>
        )}
      </div>
    </div>
  );
}

function ItemList({
  items,
  currency,
  editingItem,
  setEditingItem,
  categoryId,
  businessId,
  startTransition,
}: {
  items: MenuItem[];
  currency: string;
  editingItem: { id: string | "new"; categoryId: string | null } | null;
  setEditingItem: (v: { id: string | "new"; categoryId: string | null } | null) => void;
  categoryId: string | null;
  businessId: string;
  startTransition: (fn: () => void) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-3">
      {items.map((item) =>
        editingItem?.id === item.id ? (
          <ItemForm
            key={item.id}
            businessId={businessId}
            categoryId={categoryId}
            initial={item}
            onDone={() => setEditingItem(null)}
            startTransition={startTransition}
          />
        ) : (
          <div key={item.id} className="flex items-center gap-3 border-b border-zinc-100 py-2 last:border-0">
            {item.is_veg !== null && (
              <span
                className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center border-2"
                style={{ borderColor: item.is_veg ? "#0f8a0f" : "#c0392b" }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: item.is_veg ? "#0f8a0f" : "#c0392b" }}
                />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.name}</p>
              <p className="text-xs text-zinc-500">
                {item.has_portions
                  ? `Half ${currency}${item.price_half} · Full ${currency}${item.price_full}`
                  : `${currency}${item.price_full}`}
              </p>
            </div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-600">
              <input
                type="checkbox"
                checked={item.is_available}
                onChange={(e) => startTransition(() => toggleAvailability(item.id, e.target.checked))}
              />
              Available
            </label>
            <button
              onClick={() => setEditingItem({ id: item.id, categoryId })}
              className="text-xs font-medium text-zinc-600 underline"
            >
              Edit
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete "${item.name}"?`)) startTransition(() => deleteItem(item.id));
              }}
              className="text-xs font-medium text-red-500"
            >
              Delete
            </button>
          </div>
        )
      )}

      {editingItem?.id === "new" && editingItem.categoryId === categoryId ? (
        <ItemForm
          businessId={businessId}
          categoryId={categoryId}
          onDone={() => setEditingItem(null)}
          startTransition={startTransition}
        />
      ) : (
        <button
          onClick={() => setEditingItem({ id: "new", categoryId })}
          className="mt-1 self-start text-xs font-semibold text-emerald-700"
        >
          + Add item
        </button>
      )}
    </div>
  );
}

function ItemForm({
  businessId,
  categoryId,
  initial,
  onDone,
  startTransition,
}: {
  businessId: string;
  categoryId: string | null;
  initial?: MenuItem;
  onDone: () => void;
  startTransition: (fn: () => void) => void;
}) {
  const [form, setForm] = useState<ItemInput>(
    initial
      ? {
          name: initial.name,
          description: initial.description ?? "",
          is_veg: initial.is_veg === null ? "na" : initial.is_veg ? "veg" : "non-veg",
          has_portions: initial.has_portions,
          price_full: String(initial.price_full),
          price_half: initial.price_half != null ? String(initial.price_half) : "",
        }
      : emptyItem
  );

  const submit = () => {
    if (initial) {
      startTransition(() => updateItem(initial.id, businessId, categoryId, form));
    } else {
      startTransition(() => addItem(businessId, categoryId, form));
    }
    onDone();
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-zinc-50 p-3">
      <div className="flex gap-2">
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Item name"
          autoFocus
          className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-sm"
        />
        <select
          value={form.is_veg}
          onChange={(e) => setForm({ ...form, is_veg: e.target.value as ItemInput["is_veg"] })}
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
        >
          <option value="veg">Veg</option>
          <option value="non-veg">Non-veg</option>
          <option value="na">N/A</option>
        </select>
      </div>
      <input
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        placeholder="Description (optional)"
        className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
      />
      <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-600">
        <input
          type="checkbox"
          checked={form.has_portions}
          onChange={(e) => setForm({ ...form, has_portions: e.target.checked })}
        />
        Has Half / Full portions
      </label>
      <div className="flex gap-2">
        {form.has_portions && (
          <input
            value={form.price_half}
            onChange={(e) => setForm({ ...form, price_half: e.target.value })}
            placeholder="Half price"
            type="number"
            className="w-28 rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />
        )}
        <input
          value={form.price_full}
          onChange={(e) => setForm({ ...form, price_full: e.target.value })}
          placeholder={form.has_portions ? "Full price" : "Price"}
          type="number"
          className="w-28 rounded border border-zinc-300 px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={!form.name.trim() || !form.price_full}
          className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          Save
        </button>
        <button onClick={onDone} className="rounded px-3 py-1.5 text-xs font-medium text-zinc-500">
          Cancel
        </button>
      </div>
    </div>
  );
}
