<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Snapdesk — QR Menu + WhatsApp Ordering

Phase 1: customer scans a table QR → `/m/[slug]?table=N` menu page → cart in
localStorage → checkout opens `wa.me` with a pre-filled order message.
Full requirements: `PHASE1_SPEC.md` (treat it as the source of truth).

## Commands

- `npm run dev` — dev server (Turbopack)
- `npm run build` — production build
- `npm run lint` — ESLint

## Setup

1. Create a Supabase project; run `supabase/schema.sql` then `supabase/seed.sql`
   in the SQL editor.
2. Fill `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`.
3. Demo routes: `/m/spice-garden?table=5` and `/m/glow-beauty`.

## Structure

- `app/m/[slug]/page.tsx` — Server Component: fetches business/menu/testimonials, renders testimonials; 404 via `not-found.tsx`
- `app/m/[slug]/CartClient.tsx` — all client UI: header, category pills, item cards, portion sheet, cart drawer, WhatsApp checkout
- `app/m/[slug]/ReviewForm.tsx` + `actions.ts` — customer review submission (pending until owner approves)
- `lib/cart.ts` — cart types + localStorage persistence (key `qrmenu_cart_<slug>`, per-business)
- `lib/whatsapp.ts` — order message formatting + `wa.me` link building
- `lib/supabase.ts` — anon Supabase client

## Conventions

- No auth, dashboard, or payments here — those live in ../BusinessDashboard.
- The ONLY write path is review submission (`app/m/[slug]/actions.ts`):
  anonymous inserts into `testimonials` restricted to status='pending' by RLS
  (`supabase/reviews_policy.sql`); owners approve in the dashboard.
- Cart line identity = `itemId + portion` (Half/Full are separate lines).
- Checkout must use `window.location.href` (not `window.open`) for webview compatibility.
