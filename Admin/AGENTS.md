<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

Notably: `middleware.ts` is renamed **`proxy.ts`** (exported function `proxy`), same `config.matcher` API.

# Snapdesk — Admin (Phase 3)

Internal super-admin panel: approve/reject business registrations, revoke
approval, enable/disable live menus. Shares the SAME Supabase project as
UserMenuList + BusinessDashboard.

## Security model (different from the other apps!)

- Server actions and pages use the **service-role key** (`lib/service.ts`),
  which BYPASSES RLS entirely.
- The security boundary is therefore `lib/admin.ts`: a session must exist AND
  the user must have a row in the `admin_users` table. Every server action
  goes through the `adminAction()` wrapper in `app/actions.ts` (admin check +
  mandatory `audit_log` row) — never bypass it.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only (no `NEXT_PUBLIC_` prefix) and
  `lib/service.ts` imports `server-only` so client imports fail at build.

## Setup

1. `.env.local`: same `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` as the other apps,
   plus `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Settings → API keys).
2. Requires `../BusinessDashboard/supabase/phase3.sql` applied, including its
   manual step: insert your auth user into `admin_users`.
3. Admin login accounts are created by hand: Supabase → Authentication →
   Users → Add user (no self-signup in this app).

## Structure

- `proxy.ts` + `lib/supabase/*` — session refresh, everything except /login gated
- `lib/admin.ts` — `getAdmin()` (pages) / `requireAdmin()` (actions)
- `lib/service.ts` — service-role Supabase client
- `lib/audit.ts` — `writeAudit()`; every mutation logs exactly one row
- `app/page.tsx` — inquiry queue + business lists by status, stats
- `app/actions.ts` — `adminAction()` wrapper; approve(plan, tables) / reject /
  suspend / reactivate / delete-rejected
- UI: shadcn/ui (components/ui/*, Tailwind v4). Use shadcn components for new screens; older pages migrate as touched. Note: `bg-muted` in generated shadcn components is rewritten to `bg-muted-bg` because this app uses `--muted` as a text color.
