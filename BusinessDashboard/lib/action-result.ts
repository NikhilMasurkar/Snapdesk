/**
 * Shared result shape for server actions. Actions never throw for expected
 * failures (validation, RLS denial) — they return an error message the
 * client can toast.
 */
export type ActionResult = { ok: true } | { ok: false; error: string };

export const ok: ActionResult = { ok: true };

export function fail(error: string): ActionResult {
  return { ok: false, error };
}
