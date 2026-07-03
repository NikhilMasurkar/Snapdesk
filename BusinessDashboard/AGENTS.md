<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

Notably: `middleware.ts` is renamed **`proxy.ts`** (exported function `proxy`), same `config.matcher` API.
<!-- END:nextjs-agent-rules -->

# Snapdesk — Business Dashboard (Phase 2)

Owner-facing dashboard: menu editing (categories/items/availability), business
settings (WhatsApp number, tagline, live toggle), testimonial moderation.
Auth via Supabase (email/password). One business per owner.

Shares the SAME Supabase project/backend as the public menu app
(`../UserMenuList`). No separate backend to manage.

## Commands

- `npm run dev` — dev server
- `npm run build` — production build

## Setup

1. Run `supabase/phase2_auth.sql` against the existing Supabase project
   (after UserMenuList's `schema.sql` + `seed.sql` are already applied).
2. Fill `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` in
   `.env.local` — same values as UserMenuList's `.env.local`.
3. Sign up an owner account at `/login`, then link it to a business:
   `update businesses set owner_id = '<uuid>' where slug = '<slug>';`

## Structure

- `proxy.ts` — session refresh + route gating (redirects unauthenticated
  users away from `/dashboard`, authenticated users away from `/login`)
- `lib/supabase/{server,client,middleware}.ts` — Supabase SSR client setup
- `lib/dal.ts` — `requireUser()`, `getOwnerBusiness()`, wrapped in React
  `cache()` (layout + page both call them; dedupe avoids double queries).
  The only place that trusts `owner_id = auth.uid()`.
- `lib/action-result.ts` — `ActionResult` shape all server actions return
- `components/ui/` — shadcn/ui primitives (Radix + Tailwind; installed via
  `npx shadcn add <name>`, do not hand-edit unless intentional)
- `components/dashboard/` — app-specific shared components (nav, VegDot)
- `app/login/` — email/password login + signup (Server Actions + Tabs)
- `app/dashboard/menu/` — category cards, item add/edit Dialogs, delete
  AlertDialogs, availability Switch with `useOptimistic`
- `app/dashboard/settings/` — typed business profile form
- `app/dashboard/testimonials/` — approve/reject with status Badges
- `app/dashboard/*/loading.tsx` — Skeleton states per route

## Conventions

- All writes go through Supabase RLS policies scoped to
  `owner_id = auth.uid()` (see `phase2_auth.sql`) — that's the real security
  boundary, not application-level checks.
- One business per owner (product decision — no multi-business switcher).
- Every server action returns `ActionResult` (`lib/action-result.ts`):
  validate input, check the Supabase `error`, never swallow failures.
  Clients toast errors via sonner — no silent no-ops.
- UI components are shadcn/ui only — do NOT add Ant Design/MUI/etc; they
  bloat the bundle and clash with the Tailwind token theme.
- Availability/status flips use `useOptimistic` inside `startTransition`
  so the UI responds instantly; the revalidated server state reconciles.
- Public menu app URL comes from `NEXT_PUBLIC_MENU_BASE_URL` (env), not
  hardcoded.
