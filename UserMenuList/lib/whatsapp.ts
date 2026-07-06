import type { CartLine } from './cart';
import { cartTotal } from './cart';
import { formatMoney } from './types';

export type OrderDetails = {
  businessName: string;
  currency: string;
  table: string | null;
  lines: CartLine[];
  note: string;
  /** Server-generated order short ID, e.g. 'A4X9'. Omitted if the insert failed. */
  shortId?: string | null;
};

export function buildOrderMessage(order: OrderDetails): string {
  const { businessName, currency, table, lines, note, shortId } = order;

  const parts: string[] = [`🧾 New Order – ${businessName}`];
  if (shortId) parts.push(`Order ID: #${shortId}`);
  if (table) parts.push(`📍 Table: ${table}`);
  parts.push('');

  for (const line of lines) {
    const portion =
      line.portion === 'half' ? ' (Half)' : line.portion === 'full' ? ' (Full)' : '';
    const lineTotal = formatMoney(currency, line.unitPrice * line.qty);
    parts.push(`${line.qty}x ${line.name}${portion} – ${lineTotal}`);
  }

  parts.push('');
  parts.push(`Total: ${formatMoney(currency, cartTotal(lines))}`);

  const trimmedNote = note.trim();
  if (trimmedNote) parts.push(`Note: ${trimmedNote}`);

  return parts.join('\n');
}

export function buildWaLink(whatsappNumber: string, message: string): string {
  const number = whatsappNumber.replace(/\D/g, ''); // digits only, no '+', no spaces
  // Stay well under URL length limits (~1500 chars for the message)
  const safeMessage = message.length > 1500 ? `${message.slice(0, 1497)}...` : message;
  return `https://wa.me/${number}?text=${encodeURIComponent(safeMessage)}`;
}
