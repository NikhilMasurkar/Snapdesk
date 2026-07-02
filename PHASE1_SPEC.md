# QR Menu + WhatsApp Ordering — Phase 1 Build Spec

> **How to use this file:** Put this file in the root of a new empty folder, open Claude Code in that folder, and say: *"Read PHASE1_SPEC.md and build the project exactly as specified. Start with Step 1."*

---

## 1. What Phase 1 is (and is NOT)

**Phase 1 = the customer-facing experience only.**

A customer scans a QR code on a table → opens the business's menu page in their browser → browses items → adds to cart (with Half/Full portion choice) → checks out → WhatsApp opens with a pre-filled order message → they tap Send → the business owner receives the order on normal WhatsApp.

**In scope:**
- Public menu page per business at `/m/[slug]?table=N`
- Categories, items, Half/Full pricing, veg/non-veg tags, sold-out state
- Cart (localStorage, no login, no backend cart)
- Checkout via `wa.me` deep link with formatted order message
- Approved testimonials displayed at the bottom of the menu page
- Menu data served from Supabase (owner dashboard comes in Phase 2 — for now data is inserted via SQL seed)

**NOT in scope (do not build these yet):**
- Owner dashboard, admin panel, auth of any kind
- Payments, order tracking, notifications
- Testimonial submission form (display only in Phase 1)
- QR code generation UI (generate QRs manually for the pilot)

---

## 2. Tech stack (fixed — do not substitute)

| Layer | Choice |
|---|---|
| Framework | Next.js 14+ (App Router, TypeScript) |
| Styling | Tailwind CSS |
| Database | Supabase (Postgres) via `@supabase/supabase-js` |
| Hosting target | Vercel |
| State | React state + localStorage for cart (no Redux/Zustand) |

Environment variables (`.env.local`):
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

---

## 3. Database schema (run in Supabase SQL editor)

```sql
-- Businesses
create table businesses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,            -- e.g. 'spice-garden'
  name text not null,
  type text not null default 'restaurant', -- restaurant | parlour | bakery | other
  whatsapp_number text not null,        -- E.164 without '+', e.g. '919812345678'
  logo_url text,
  tagline text,
  menu_label text not null default 'Menu', -- 'Menu' | 'Services' | 'Price List'
  currency text not null default '₹',
  is_active boolean not null default true,
  created_at timestamptz default now()
);

-- Menu categories (ordered)
create table categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,                   -- e.g. 'Starters', 'Hair Care'
  sort_order int not null default 0
);

-- Menu items
create table menu_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  name text not null,
  description text,
  photo_url text,
  is_veg boolean,                       -- null = not applicable (parlour/bakery)
  has_portions boolean not null default false,
  price_full numeric(10,2) not null,    -- single price when has_portions = false
  price_half numeric(10,2),             -- only used when has_portions = true
  is_available boolean not null default true,
  sort_order int not null default 0
);

-- Testimonials (display-only in Phase 1)
create table testimonials (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  customer_name text not null,
  rating int not null check (rating between 1 and 5),
  text text not null,
  status text not null default 'pending', -- pending | approved | rejected
  created_at timestamptz default now()
);

-- Public read access (anon key) — menu pages are public
alter table businesses enable row level security;
alter table categories enable row level security;
alter table menu_items enable row level security;
alter table testimonials enable row level security;

create policy "public read businesses" on businesses for select using (is_active = true);
create policy "public read categories" on categories for select using (true);
create policy "public read items" on menu_items for select using (true);
create policy "public read approved testimonials" on testimonials
  for select using (status = 'approved');
```

### Seed data (one demo restaurant)

See `supabase/seed.sql` — it resolves business/category IDs automatically (no manual ID replacement needed).

---

## 4. Routes & file structure

```
app/
  m/[slug]/page.tsx        → the menu page (Server Component fetches data)
  m/[slug]/CartClient.tsx  → client components: cart drawer, item cards, checkout
  layout.tsx, globals.css
lib/
  supabase.ts              → createClient with env vars
  whatsapp.ts              → buildOrderMessage(), buildWaLink()
  cart.ts                  → cart types + localStorage helpers
```

- `/m/[slug]` reads `?table=` from searchParams. If present, show a small badge ("Table 5") in the header and include it in the WhatsApp message. If absent, omit the table line entirely (parlour/bakery case).
- Unknown slug or `is_active = false` → friendly 404 page ("This menu is not available").

---

## 5. Menu page UI requirements (mobile-first, 380px design width)

**Header:** business logo/initial, name, tagline, table badge if `?table=` present.

**Category navigation:** horizontally scrollable pill bar, sticky under the header. Tapping a pill scrolls to that category section.

**Item card:** name, veg/non-veg dot (green/red square-dot Indian convention; hide if `is_veg` is null), description (1–2 lines), price display:
- `has_portions = true` → show both: "Half ₹150 · Full ₹280" and the add flow asks Half or Full
- `has_portions = false` → single price
- `is_available = false` → card greyed out, "Sold out" label, add button disabled

**Add to cart:** tapping "ADD" on a portioned item opens a small bottom sheet to pick Half/Full and quantity. Non-portioned items add directly with a +/- stepper appearing in place of ADD.

**Sticky cart bar:** fixed at bottom when cart is non-empty: "3 items · ₹510 — View Cart".

**Cart view (drawer or route section):**
- Line items: name, portion, qty stepper, line total; remove item
- Optional order note textarea ("less spicy", "no onion")
- Grand total
- Big WhatsApp-green button: "Place Order on WhatsApp"

**Testimonials section** at page bottom:
- Summary line: average stars + count (computed from approved testimonials)
- Up to 5 most recent approved testimonials as cards (name, stars, text)
- Hide the whole section if there are no approved testimonials

**General:** clean, fast, no login anywhere, works on slow connections (minimal JS, no heavy images in Phase 1).

---

## 6. Cart logic (localStorage)

- Key: `qrmenu_cart_<slug>` (carts are per-business; scanning another restaurant's QR must not show this cart)
- Cart line uniqueness = `item_id + portion` (Half and Full of the same item are separate lines)
- Persist on every change; restore on load; clear after checkout button is tapped
- Table number: read from URL on first load and store alongside the cart so it survives refresh/navigation

```ts
type CartLine = {
  itemId: string;
  name: string;
  portion: 'half' | 'full' | null; // null = no portions
  unitPrice: number;
  qty: number;
};
```

---

## 7. WhatsApp checkout (the core feature — get this exactly right)

Build the message, URL-encode it, open `https://wa.me/<number>?text=<encoded>`.

**Message template:**
```
🧾 New Order – {business name}
📍 Table: {table}        ← omit this line entirely if no table param

{qty}x {item name} ({Half|Full}) – ₹{lineTotal}
...one line per cart item; omit the (portion) part when portion is null

Total: ₹{grandTotal}
Note: {note}             ← omit if empty
```

**Implementation rules:**
- Use `encodeURIComponent` on the full message; newlines as `\n` before encoding
- Number format: digits only with country code, no `+`, no spaces (e.g. `919812345678`)
- Open with `window.location.href = waLink` (NOT `window.open`) — more reliable inside in-app browsers (Instagram/Google Lens open QR links in webviews where popups fail)
- Keep the total message under ~1500 characters to be safe with URL length limits
- After redirecting, clear the cart and show a "Order sent — the restaurant will confirm on WhatsApp" state if the user returns to the tab

---

## 8. Acceptance checklist (test all of these before calling Phase 1 done)

1. `/m/spice-garden?table=5` loads the seeded menu with categories in order
2. Table 5 badge visible; `/m/spice-garden` (no param) shows no badge and no Table line in the message
3. Adding Half and Full of the same item creates two separate cart lines
4. Sold-out item cannot be added
5. Refresh mid-order → cart and table number persist
6. Checkout on a real phone opens WhatsApp with the exact formatted message and correct total
7. Two different business slugs keep independent carts
8. Unknown slug shows the friendly 404
9. Testimonials show only `approved` ones, with correct average rating
10. Entire flow works with JavaScript on a mid-range Android over slow 4G

---

## 9. Suggested Claude Code prompt sequence

Run these one at a time in Claude Code:

1. "Read PHASE1_SPEC.md fully. Scaffold the Next.js 14 + TypeScript + Tailwind project with the file structure in section 4, including lib/supabase.ts using the env vars."
2. "Implement the database types and data fetching for /m/[slug] per sections 3–5. Use a Server Component for the initial fetch."
3. "Build the menu page UI per section 5: header, sticky category pills, item cards with veg dots, Half/Full pricing, sold-out state."
4. "Implement the cart per section 6: localStorage persistence, portion-aware lines, bottom sheet for portion selection, sticky cart bar, cart drawer with note field."
5. "Implement WhatsApp checkout exactly per section 7, including the in-app-browser-safe redirect."
6. "Add the testimonials section per section 5. Then walk me through the acceptance checklist in section 8 and fix anything that fails."

---

## 10. Immediately after Phase 1 (reminder)

- Generate table QRs pointing to `https://<your-domain>/m/<slug>?table=N` (any QR tool works for the pilot)
- Put this in front of ONE real business and watch real customers use it
- Phase 2 = owner dashboard (menu editing, availability toggle, WhatsApp number setting, testimonial approval)
