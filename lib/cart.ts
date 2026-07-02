export type CartLine = {
  itemId: string;
  name: string;
  portion: 'half' | 'full' | null; // null = no portions
  unitPrice: number;
  qty: number;
};

export type StoredCart = {
  lines: CartLine[];
  table: string | null;
  note: string;
};

export const EMPTY_CART: StoredCart = { lines: [], table: null, note: '' };

const cartKey = (slug: string) => `qrmenu_cart_${slug}`;
const sentKey = (slug: string) => `qrmenu_sent_${slug}`;

/** Uniqueness of a cart line = item + portion. */
export function lineKey(itemId: string, portion: CartLine['portion']): string {
  return `${itemId}:${portion ?? 'single'}`;
}

export function loadCart(slug: string): StoredCart {
  if (typeof window === 'undefined') return EMPTY_CART;
  try {
    const raw = window.localStorage.getItem(cartKey(slug));
    if (!raw) return EMPTY_CART;
    const parsed = JSON.parse(raw) as StoredCart;
    if (!Array.isArray(parsed.lines)) return EMPTY_CART;
    return { lines: parsed.lines, table: parsed.table ?? null, note: parsed.note ?? '' };
  } catch {
    return EMPTY_CART;
  }
}

export function saveCart(slug: string, cart: StoredCart): void {
  try {
    window.localStorage.setItem(cartKey(slug), JSON.stringify(cart));
  } catch {
    // storage full / private mode — cart just won't persist
  }
}

export function clearCart(slug: string): void {
  try {
    window.localStorage.removeItem(cartKey(slug));
  } catch {
    // ignore
  }
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.qty, 0);
}

export function cartTotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
}

/** Flag so we can show "Order sent" if the user comes back to the tab. */
export function markOrderSent(slug: string): void {
  try {
    window.sessionStorage.setItem(sentKey(slug), '1');
  } catch {
    // ignore
  }
}

export function consumeOrderSent(slug: string): boolean {
  try {
    const sent = window.sessionStorage.getItem(sentKey(slug)) === '1';
    if (sent) window.sessionStorage.removeItem(sentKey(slug));
    return sent;
  } catch {
    return false;
  }
}
