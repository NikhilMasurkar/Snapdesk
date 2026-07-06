"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MenuItem, MenuSection } from "@/lib/types";
import { formatMoney } from "@/lib/types";
import {
  type CartLine,
  cartCount,
  cartTotal,
  clearCart,
  consumeOrderSent,
  lineKey,
  loadCart,
  markOrderSent,
  saveCart,
} from "@/lib/cart";
import { buildOrderMessage, buildWaLink } from "@/lib/whatsapp";
import { placeOrder } from "./actions";

type Props = {
  slug: string;
  businessId: string;
  businessName: string;
  whatsappNumber: string;
  currency: string;
  logoUrl: string | null;
  tagline: string | null;
  menuLabel: string;
  sections: MenuSection[];
  tableFromUrl: string | null;
  /** Plan-level flag: does this business have online ordering at all? */
  orderingEnabled: boolean;
  /** Owner toggle: temporarily open/closed for orders. */
  acceptingOrders: boolean;
};

export default function MenuClient({
  slug,
  businessId,
  businessName,
  whatsappNumber,
  currency,
  logoUrl,
  tagline,
  menuLabel,
  sections,
  tableFromUrl,
  orderingEnabled,
  acceptingOrders,
}: Props) {
  const [hydrated, setHydrated] = useState(false);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [note, setNote] = useState("");
  const [table, setTable] = useState<string | null>(tableFromUrl);
  const [sheetItem, setSheetItem] = useState<MenuItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentShortId, setSentShortId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [placing, setPlacing] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Stable idempotency key for the current cart. Reused across checkout
  // retries/double-taps (the DB dedupes on it) and reset after a send.
  const clientKeyRef = useRef<string | null>(null);
  const ensureClientKey = () => {
    if (!clientKeyRef.current) clientKeyRef.current = crypto.randomUUID();
    return clientKeyRef.current;
  };

  // Ordering is live only when the plan allows it AND the owner is open.
  const orderingOn = orderingEnabled && acceptingOrders;

  // Restore cart on load; the URL table param wins over the stored one.
  // localStorage is only readable post-mount, so setting state here is
  // unavoidable (reading it during render would break SSR hydration).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const stored = loadCart(slug);
    setLines(stored.lines);
    setNote(stored.note);
    setTable(tableFromUrl ?? stored.table);
    const prior = consumeOrderSent(slug);
    if (prior.sent) {
      setSent(true);
      setSentShortId(prior.shortId);
    }
    setHydrated(true);
  }, [slug, tableFromUrl]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Persist on every change
  useEffect(() => {
    if (!hydrated) return;
    saveCart(slug, { lines, table, note });
  }, [hydrated, slug, lines, table, note]);

  // Highlight the category pill for the section currently in view
  useEffect(() => {
    const onScroll = () => {
      let current = sections[0]?.id ?? null;
      for (const s of sections) {
        const el = document.getElementById(`section-${s.id}`);
        if (el && el.getBoundingClientRect().top <= 120) current = s.id;
      }
      setActiveSection(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [sections]);

  const count = useMemo(() => cartCount(lines), [lines]);
  const total = useMemo(() => cartTotal(lines), [lines]);

  const trimmedQuery = query.trim().toLowerCase();
  const displaySections = useMemo(() => {
    if (!trimmedQuery) return sections;
    return sections
      .map((s) => ({
        ...s,
        items: s.items.filter(
          (i) =>
            i.name.toLowerCase().includes(trimmedQuery) ||
            (i.description ?? "").toLowerCase().includes(trimmedQuery)
        ),
      }))
      .filter((s) => s.items.length > 0);
  }, [sections, trimmedQuery]);

  const addToCart = (item: MenuItem, portion: CartLine["portion"], qty: number) => {
    const unitPrice =
      portion === "half" ? Number(item.price_half) : Number(item.price_full);
    setLines((prev) => {
      const key = lineKey(item.id, portion);
      const idx = prev.findIndex((l) => lineKey(l.itemId, l.portion) === key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + qty };
        return next;
      }
      return [...prev, { itemId: item.id, name: item.name, portion, unitPrice, qty }];
    });
    setSent(false);
    setCheckoutError(null);
  };

  const setLineQty = (key: string, qty: number) => {
    setLines((prev) =>
      qty <= 0
        ? prev.filter((l) => lineKey(l.itemId, l.portion) !== key)
        : prev.map((l) =>
            lineKey(l.itemId, l.portion) === key ? { ...l, qty } : l
          )
    );
  };

  const qtyInCart = (itemId: string, portion: CartLine["portion"]) =>
    lines.find((l) => lineKey(l.itemId, l.portion) === lineKey(itemId, portion))
      ?.qty ?? 0;

  const scrollToSection = (id: string) => {
    document
      .getElementById(`section-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const finishCheckout = (shortId: string | null) => {
    const message = buildOrderMessage({
      businessName,
      currency,
      table,
      lines,
      note,
      shortId,
    });
    const link = buildWaLink(whatsappNumber, message);
    markOrderSent(slug, shortId);
    clearCart(slug);
    clientKeyRef.current = null; // next order gets a fresh idempotency key
    setLines([]);
    setNote("");
    setDrawerOpen(false);
    setSentShortId(shortId);
    setSent(true);
    // location.href (not window.open): reliable inside in-app browsers/webviews
    window.location.href = link;
  };

  const handleCheckout = async () => {
    if (lines.length === 0 || placing || !orderingOn) return;
    setPlacing(true);
    setCheckoutError(null);
    try {
      const result = await placeOrder({
        businessId,
        table,
        note,
        lines,
        clientKey: ensureClientKey(),
      });
      if (result.ok) {
        finishCheckout(result.shortId);
      } else if (result.blocked) {
        // DB deliberately refused (flood cap / closed) — surface it, no send.
        setCheckoutError(result.error);
      } else {
        // Soft failure (network/config): never block a real order — send
        // to WhatsApp without the order ID line.
        finishCheckout(null);
      }
    } catch {
      finishCheckout(null);
    } finally {
      setPlacing(false);
    }
  };

  return (
    <>
      {/* Header */}
      <header className="flex items-center gap-3 px-4 pb-3 pt-5">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            className="h-12 w-12 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 text-lg font-bold text-white">
            {businessName.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold leading-tight">
            {businessName}
          </h1>
          {tagline && (
            <p className="truncate text-xs text-zinc-500">{tagline}</p>
          )}
        </div>
        {table && (
          <span className="shrink-0 rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white">
            Table {table}
          </span>
        )}
      </header>

      {/* Order-sent banner */}
      {sent && (
        <div className="mx-4 mb-2 flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          <span aria-hidden>✅</span>
          <p className="flex-1">
            Order sent — the restaurant will confirm on WhatsApp.
            {sentShortId && (
              <>
                {" "}
                Your order ID:{" "}
                <span className="font-bold">#{sentShortId}</span>.
              </>
            )}
          </p>
          <button
            onClick={() => setSent(false)}
            aria-label="Dismiss"
            className="text-emerald-700"
          >
            ✕
          </button>
        </div>
      )}

      {/* Ordering-closed banner */}
      {!orderingOn && (
        <div className="mx-4 mb-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          {orderingEnabled
            ? "This restaurant isn’t taking orders right now. You can still browse the menu."
            : "Online ordering isn’t available here — please order with the staff."}
        </div>
      )}

      {/* Sticky search + category pills */}
      {sections.length > 0 && (
        <div className="sticky top-0 z-20 border-b border-zinc-100 bg-white">
          <div className="px-4 pb-2 pt-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${menuLabel.toLowerCase()}…`}
              aria-label="Search menu"
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-sm outline-none focus:border-zinc-400"
            />
          </div>
          {!trimmedQuery && (
            <nav className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-2">
              {sections.map((s) => (
                <button
                  key={s.id}
                  onClick={() => scrollToSection(s.id)}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    activeSection === s.id
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-700"
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </nav>
          )}
        </div>
      )}

      {/* Menu sections */}
      <main className="flex-1 px-4">
        {sections.length === 0 && (
          <p className="py-16 text-center text-sm text-zinc-500">
            {menuLabel} coming soon.
          </p>
        )}
        {sections.length > 0 && displaySections.length === 0 && (
          <p className="py-16 text-center text-sm text-zinc-500">
            No items match “{query.trim()}”.
          </p>
        )}
        {displaySections.map((section) => (
          <section
            key={section.id}
            id={`section-${section.id}`}
            className="scroll-mt-16 pt-5"
          >
            <h2 className="text-base font-bold">{section.name}</h2>
            <div className="mt-2 flex flex-col divide-y divide-zinc-100">
              {section.items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  currency={currency}
                  ordering={orderingOn}
                  qtyInCart={qtyInCart(item.id, item.has_portions ? "full" : null)}
                  onAdd={() =>
                    item.has_portions
                      ? setSheetItem(item)
                      : addToCart(item, null, 1)
                  }
                  onStep={(delta) => {
                    const current = qtyInCart(item.id, null);
                    setLineQty(lineKey(item.id, null), current + delta);
                  }}
                />
              ))}
            </div>
          </section>
        ))}
      </main>

      {/* Sticky cart bar */}
      {orderingOn && count > 0 && (
        <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-md -translate-x-1/2 p-3">
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex w-full items-center justify-between rounded-xl bg-wa px-4 py-3.5 font-semibold text-white shadow-lg active:bg-wa-dark"
          >
            <span>
              {count} item{count > 1 ? "s" : ""} · {formatMoney(currency, total)}
            </span>
            <span>View Cart →</span>
          </button>
        </div>
      )}

      {/* Portion bottom sheet */}
      {sheetItem && (
        <PortionSheet
          item={sheetItem}
          currency={currency}
          onClose={() => setSheetItem(null)}
          onAdd={(portion, qty) => {
            addToCart(sheetItem, portion, qty);
            setSheetItem(null);
          }}
        />
      )}

      {/* Cart drawer */}
      {drawerOpen && (
        <Overlay onClose={() => setDrawerOpen(false)}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">Your order</h2>
            <button
              onClick={() => setDrawerOpen(false)}
              aria-label="Close cart"
              className="rounded-full bg-zinc-100 px-2.5 py-1 text-sm"
            >
              ✕
            </button>
          </div>

          {lines.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">
              Your cart is empty.
            </p>
          ) : (
            <>
              <ul className="flex flex-col divide-y divide-zinc-100">
                {lines.map((line) => {
                  const key = lineKey(line.itemId, line.portion);
                  return (
                    <li key={key} className="flex items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {line.name}
                          {line.portion && (
                            <span className="text-zinc-500">
                              {" "}
                              · {line.portion === "half" ? "Half" : "Full"}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {formatMoney(currency, line.unitPrice)} each
                        </p>
                      </div>
                      <Stepper
                        qty={line.qty}
                        onChange={(qty) => setLineQty(key, qty)}
                      />
                      <span className="w-16 text-right text-sm font-semibold">
                        {formatMoney(currency, line.unitPrice * line.qty)}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <label className="mt-3 block">
                <span className="text-xs font-medium text-zinc-500">
                  Note for the kitchen (optional)
                </span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. less spicy, no onion"
                  rows={2}
                  maxLength={200}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-sm outline-none focus:border-zinc-400"
                />
              </label>

              <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3">
                <span className="font-semibold">Total</span>
                <span className="text-lg font-bold">
                  {formatMoney(currency, total)}
                </span>
              </div>

              {checkoutError && (
                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-700">
                  {checkoutError}
                </p>
              )}

              <button
                onClick={handleCheckout}
                disabled={placing}
                className="mt-4 w-full rounded-xl bg-wa py-4 text-base font-bold text-white active:bg-wa-dark disabled:opacity-60"
              >
                {placing ? "Placing order…" : "Place Order on WhatsApp"}
              </button>
              <p className="mt-2 text-center text-xs text-zinc-400">
                WhatsApp will open with your order pre-filled — just tap Send.
              </p>
            </>
          )}
        </Overlay>
      )}
    </>
  );
}

function VegDot({ isVeg }: { isVeg: boolean }) {
  const color = isVeg ? "#0f8a0f" : "#c0392b";
  return (
    <span
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center border-2"
      style={{ borderColor: color }}
      aria-label={isVeg ? "Vegetarian" : "Non-vegetarian"}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
    </span>
  );
}

function Stepper({
  qty,
  onChange,
  disabled = false,
}: {
  qty: number;
  onChange: (qty: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center rounded-lg border border-zinc-200">
      <button
        onClick={() => onChange(qty - 1)}
        disabled={disabled}
        aria-label="Decrease quantity"
        className="px-3 py-1.5 text-base font-bold text-zinc-700 disabled:text-zinc-300"
      >
        −
      </button>
      <span className="min-w-6 text-center text-sm font-semibold">{qty}</span>
      <button
        onClick={() => onChange(qty + 1)}
        disabled={disabled}
        aria-label="Increase quantity"
        className="px-3 py-1.5 text-base font-bold text-zinc-700 disabled:text-zinc-300"
      >
        +
      </button>
    </div>
  );
}

function ItemCard({
  item,
  currency,
  ordering,
  qtyInCart,
  onAdd,
  onStep,
}: {
  item: MenuItem;
  currency: string;
  ordering: boolean;
  qtyInCart: number;
  onAdd: () => void;
  onStep: (delta: number) => void;
}) {
  const soldOut = !item.is_available;

  return (
    <article
      className={`flex items-start gap-3 py-3 ${soldOut ? "opacity-50" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {item.is_veg !== null && <VegDot isVeg={item.is_veg} />}
          <h3 className="text-sm font-semibold">{item.name}</h3>
        </div>
        {item.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">
            {item.description}
          </p>
        )}
        <p className="mt-1 text-sm text-zinc-700">
          {item.has_portions && item.price_half != null ? (
            <>
              Half {formatMoney(currency, Number(item.price_half))} · Full{" "}
              {formatMoney(currency, Number(item.price_full))}
            </>
          ) : (
            formatMoney(currency, Number(item.price_full))
          )}
        </p>
        {soldOut && (
          <span className="mt-1 inline-block rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
            Sold out
          </span>
        )}
      </div>

      {(item.photo_url || ordering) && (
        <div className="flex shrink-0 flex-col items-center gap-1.5 pt-0.5">
          {item.photo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.photo_url}
              alt={item.name}
              loading="lazy"
              className={`h-20 w-24 rounded-xl border border-zinc-100 object-cover ${
                soldOut ? "grayscale" : ""
              }`}
            />
          )}
          {ordering &&
            (soldOut ? (
              <button
                disabled
                className="rounded-lg border border-zinc-200 px-5 py-1.5 text-sm font-bold text-zinc-300"
              >
                ADD
              </button>
            ) : !item.has_portions && qtyInCart > 0 ? (
              <Stepper qty={qtyInCart} onChange={(q) => onStep(q - qtyInCart)} />
            ) : (
              <button
                onClick={onAdd}
                className="rounded-lg border border-emerald-600 px-5 py-1.5 text-sm font-bold text-emerald-700 active:bg-emerald-50"
              >
                ADD
                {item.has_portions && (
                  <span className="block text-[10px] font-normal text-zinc-400">
                    Half / Full
                  </span>
                )}
              </button>
            ))}
        </div>
      )}
    </article>
  );
}

function Overlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative z-10 max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 pb-6">
        {children}
      </div>
    </div>
  );
}

function PortionSheet({
  item,
  currency,
  onClose,
  onAdd,
}: {
  item: MenuItem;
  currency: string;
  onClose: () => void;
  onAdd: (portion: "half" | "full", qty: number) => void;
}) {
  const [portion, setPortion] = useState<"half" | "full">("full");
  const [qty, setQty] = useState(1);

  const unitPrice =
    portion === "half" ? Number(item.price_half) : Number(item.price_full);

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center gap-2">
        {item.is_veg !== null && <VegDot isVeg={item.is_veg} />}
        <h2 className="text-base font-bold">{item.name}</h2>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {(["half", "full"] as const).map((p) => {
          const price = p === "half" ? item.price_half : item.price_full;
          if (price == null) return null;
          const selected = portion === p;
          return (
            <button
              key={p}
              onClick={() => setPortion(p)}
              className={`flex items-center justify-between rounded-xl border-2 px-4 py-3 text-sm font-medium ${
                selected
                  ? "border-emerald-600 bg-emerald-50"
                  : "border-zinc-200"
              }`}
            >
              <span>{p === "half" ? "Half" : "Full"}</span>
              <span className="font-semibold">
                {formatMoney(currency, Number(price))}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-600">Quantity</span>
        <Stepper qty={qty} onChange={(q) => setQty(Math.max(1, q))} />
      </div>

      <button
        onClick={() => onAdd(portion, qty)}
        className="mt-5 w-full rounded-xl bg-emerald-600 py-3.5 text-base font-bold text-white active:bg-emerald-700"
      >
        Add to cart · {formatMoney(currency, unitPrice * qty)}
      </button>
    </Overlay>
  );
}
