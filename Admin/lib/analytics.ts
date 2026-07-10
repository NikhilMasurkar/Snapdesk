/** ₹ with thousands separators, no decimals for whole amounts. */
export function money(n: number): string {
  const v = Number(n) || 0;
  return `₹${v.toLocaleString("en-IN", {
    maximumFractionDigits: Number.isInteger(v) ? 0 : 2,
  })}`;
}

// §0.3 All daily/monthly figures reset at LOCAL midnight, not UTC (which would
// flip "today" at 5:30 AM for Indian restaurants). Platform figures use IST;
// businesses carry a per-business `timezone` column for future per-business
// reporting. ponytail: pass a tz param when a non-IST business ever exists.
export const PLATFORM_TZ = "Asia/Kolkata";

/** Y/M/D of a timestamp as seen in `tz`. */
function tzParts(date: Date, tz: string): { y: number; m: number; d: number } {
  const [y, m, d] = date
    .toLocaleDateString("en-CA", { timeZone: tz }) // en-CA = YYYY-MM-DD
    .split("-")
    .map(Number);
  return { y, m, d };
}

/** UTC instant when a given tz-local calendar date starts. */
function startOfTzDay(y: number, m: number, d: number, tz: string): Date {
  // Start from the UTC date, then correct by the tz offset at that moment.
  // Works for fixed-offset zones like IST; DST zones could be off by ≤1h at
  // the transition instant — irrelevant for IST.
  let guess = new Date(Date.UTC(y, m - 1, d));
  const asTz = tzParts(guess, tz);
  if (asTz.d !== d || asTz.m !== m) {
    // tz is ahead of UTC → local midnight is earlier in UTC. Probe backward.
    guess = new Date(guess.getTime() - 864e5);
  }
  // Refine: find the minute where the tz date flips (offset is minutes-granular).
  const dayStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  let lo = guess.getTime() - 864e5;
  let hi = guess.getTime() + 864e5;
  while (hi - lo > 60_000) {
    const mid = Math.floor((lo + hi) / 2 / 60_000) * 60_000;
    const s = new Date(mid).toLocaleDateString("en-CA", { timeZone: tz });
    if (s < dayStr) lo = mid;
    else hi = mid;
  }
  return new Date(hi);
}

/**
 * Current time window boundaries as ISO strings, anchored to tz-local
 * midnight / first-of-month. Lives here (a plain module, not a component) so
 * `Date.now()` doesn't trip the render-purity lint rule at the page level.
 */
export function timeWindows(tz: string = PLATFORM_TZ) {
  const now = new Date();
  const { y, m, d } = tzParts(now, tz);
  const todayStart = startOfTzDay(y, m, d, tz);
  const som = startOfTzDay(y, m, 1, tz);
  const spm = m === 1 ? startOfTzDay(y - 1, 12, 1, tz) : startOfTzDay(y, m - 1, 1, tz);
  return {
    som: som.toISOString(),
    spm: spm.toISOString(),
    todayStart: todayStart.toISOString(),
    days30: new Date(now.getTime() - 30 * 864e5).toISOString(),
    days14: new Date(now.getTime() - 14 * 864e5).toISOString(),
    days60: new Date(now.getTime() - 60 * 864e5).toISOString(),
  };
}

/**
 * Bucket timestamped rows into the last `days` tz-local calendar days
 * (oldest → newest), summing `valueFn` per day. Labels are "D/M".
 */
export function dailySeries<T>(
  rows: T[],
  createdAt: (row: T) => string,
  valueFn: (row: T) => number,
  days = 30,
  tz: string = PLATFORM_TZ
): { label: string; value: number }[] {
  const buckets = new Map<string, number>();
  const out: { key: string; label: string; value: number }[] = [];
  const now = Date.now();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * 864e5);
    const key = d.toLocaleDateString("en-CA", { timeZone: tz }); // YYYY-MM-DD in tz
    const [, mm, dd] = key.split("-").map(Number);
    buckets.set(key, 0);
    out.push({ key, label: `${dd}/${mm}`, value: 0 });
  }

  for (const row of rows) {
    const key = new Date(createdAt(row)).toLocaleDateString("en-CA", { timeZone: tz });
    if (buckets.has(key)) buckets.set(key, buckets.get(key)! + valueFn(row));
  }
  return out.map((o) => ({ label: o.label, value: buckets.get(o.key) ?? 0 }));
}
