/** ₹ with thousands separators, no decimals for whole amounts. */
export function money(n: number): string {
  const v = Number(n) || 0;
  return `₹${v.toLocaleString("en-IN", {
    maximumFractionDigits: Number.isInteger(v) ? 0 : 2,
  })}`;
}

export function startOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/**
 * Current time window boundaries as ISO strings. Lives here (a plain module,
 * not a component) so calling `Date.now()` doesn't trip the render-purity lint
 * rule at the page level.
 */
export function timeWindows() {
  const now = new Date();
  return {
    som: startOfMonth(now).toISOString(),
    spm: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString(),
    todayStart: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(),
    days30: new Date(now.getTime() - 30 * 864e5).toISOString(),
    days14: new Date(now.getTime() - 14 * 864e5).toISOString(),
    days60: new Date(now.getTime() - 60 * 864e5).toISOString(),
  };
}

export function startOfPrevMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth() - 1, 1);
}

/**
 * Bucket timestamped rows into the last `days` calendar days (oldest → newest),
 * summing `valueFn` per day. Labels are "D/M".
 */
export function dailySeries<T>(
  rows: T[],
  createdAt: (row: T) => string,
  valueFn: (row: T) => number,
  days = 30
): { label: string; value: number }[] {
  const buckets = new Map<string, number>();
  const out: { key: string; label: string; value: number }[] = [];
  // Work entirely in UTC so bucket keys line up with the UTC created_at
  // timestamps (mixing local + UTC dropped edge-of-day rows).
  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(todayUTC - i * 864e5);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, 0);
    out.push({ key, label: `${d.getUTCDate()}/${d.getUTCMonth() + 1}`, value: 0 });
  }

  for (const row of rows) {
    const key = new Date(createdAt(row)).toISOString().slice(0, 10);
    if (buckets.has(key)) buckets.set(key, buckets.get(key)! + valueFn(row));
  }
  return out.map((o) => ({ label: o.label, value: buckets.get(o.key) ?? 0 }));
}
