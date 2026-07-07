/** "₹280" for whole amounts, "₹280.50" otherwise. Mirrors UserMenuList. */
export function formatMoney(currency: string, amount: number): string {
  const n = Number(amount);
  return `${currency}${Number.isInteger(n) ? n : n.toFixed(2)}`;
}
