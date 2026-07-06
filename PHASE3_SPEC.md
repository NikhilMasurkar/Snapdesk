# QR Menu + WhatsApp Ordering — Phase 3 Build Spec (Revised): Admin Control + Live Order Management

> **How to use this file:** Put this file next to PHASE1_SPEC.md and PHASE2_SPEC.md in your project root, open Claude Code, and say: *"Read PHASE3_SPEC.md and build on top of the existing Phase 1+2 project. Start with Step 1."*
>
> **Prerequisite:** Phases 1 and 2 are built, deployed, and passing their checklists (including the Phase 2 security test suite).
>
> **This revision supersedes the earlier Phase 3 draft.** Changes: (a) owners cannot access the dashboard at all until admin approval — login shows a "contact support" screen; (b) signup is a full business application form; (c) orders now land LIVE in the business dashboard with a table grid, approve/reject, manual editing, and printable bills — WhatsApp becomes the customer's notification channel, the dashboard becomes the source of truth; (d) admin panel shows all business data: orders, bills, and monthly revenue.
---
## 1. What Phase 3 is
**Phase 3 = YOUR control panel + the business's live order desk.** After this phase the platform runs on an approval model where nothing happens without you, and restaurants manage real orders from a table grid instead of scrolling WhatsApp.
The five pillars (matching your requirements):
1. **Approval-gated access** — a new owner signs up with a complete business application, but CANNOT enter the dashboard until you approve. Logging in while pending shows: *"Your application is under review. Please contact support@YOURDOMAIN.com"* (set the real email in one config constant). You approve or reject every application from the admin inquiry queue. Existing (approved) owners log in normally.
2. **Admin-only QR codes** — owners never generate QRs. You set the table count, generate the printable QR PDF pack, and deliver it.
3. **Live orders in the business dashboard** — when a customer places an order from the menu page, it appears instantly (realtime) in the business dashboard AND still opens WhatsApp on the customer's phone as before. The dashboard record is authoritative; the WhatsApp message is the customer's receipt/notification.
4. **Table grid order management (mini-POS)** — the business dashboard gets a Tables tab: a grid of all tables. New order on a table → approve or reject. Approved → the running amount shows on the table tile. Tap a table → full table view: all items, manual +/− quantity, add items, running total, **Generate Bill → Print**.
5. **Admin sees everything, properly organized** — every business's orders, bills, and monthly revenue in one place, platform-wide and per-business.
**In scope:**
- Full-detail signup application (business info + owner info + logo, all fields) with login gating
- Admin panel at `/admin`: inquiry queue (approve/reject), business lifecycle (approved/suspended), owner management, feature flags + plans, QR PDF generation, per-business orders/bills/revenue, platform analytics, audit log, admin testimonial deletion
- Business dashboard additions: realtime Orders inbox, Tables grid with approve/reject and per-table amounts, table detail with manual item editing, bill generation + thermal/A4 printing
- Customer-side: scan tracking, order insert with short order ID (kept in the WhatsApp message), offline page for non-approved businesses, feature-flag respect
- Database: statuses, application fields, feature flags, orders with status + editing, bills, scan_events, admin_users, audit_log, realtime setup, all RLS/trigger updates
- **Operational gap-closers (section 10):** accepting-orders switch, order flood control, double-tap protection, bill void, CSV export, owner onboarding checklist, demo business, legal pages, menu search
**NOT in scope (Phase 4):**
- Automated payment/subscription billing (you enforce manually via suspend)
- Multi-admin permission levels (one admin role; the audit log is ready for staff later)
- Kitchen display screens, waiter apps, inventory
- Push/SMS/email notification automation
---
## 2. Stack additions
Everything from Phases 1–2 stays. Add:
| Need | Choice |
|---|---|
| QR generation | `qrcode` (npm) — server-side PNG/SVG |
| QR PDF packs | `pdf-lib` — A4 PDF, one QR card per table |
| Charts (admin + owner analytics) | `recharts` |
| Live orders | **Supabase Realtime** — postgres_changes subscription on `orders`, filtered by `business_id` (no new dependency; enable replication on the table) |
| Bill printing | Browser print (`window.print()`) with a dedicated print stylesheet: 80mm thermal layout + A4 fallback. No printer SDKs in Phase 3. |
**Service role key rules (unchanged from previous draft, critical):** server-side env only (`SUPABASE_SERVICE_ROLE_KEY`, never `NEXT_PUBLIC_`), used ONLY inside `/admin` server actions/route handlers, every handler first verifies the caller is an admin. Owner and customer paths keep using anon key + RLS.
**Config constant:** `SUPPORT_EMAIL` in one place (e.g. `lib/config.ts`) — used on the pending/suspended screens. Placeholder `support@YOURDOMAIN.com` until you have the real one.
---
## 3. Database changes (run in Supabase SQL editor)
### 3.1 Admin role

```sql
create table admin_users (
  user_id uuid primary key references auth.users(id),
  created_at timestamptz default now()
);
alter table admin_users enable row level security;
-- No policies = unreachable via anon/authenticated keys. Admin checks are server-side.
create or replace function is_admin()
returns boolean language sql security definer stable as $$
  select exists (select 1 from admin_users where user_id = auth.uid());
$$;
```

Insert yourself once:

```sql
insert into admin_users (user_id)
select id from auth.users where email = 'YOUR_EMAIL_HERE';
```

### 3.2 Business lifecycle + full application fields

```sql
alter table businesses add column status text not null default 'pending'
  check (status in ('pending','approved','suspended','rejected'));
alter table businesses add column plan text not null default 'free'
  check (plan in ('free','basic','premium'));
alter table businesses add column table_count int not null default 0 check (table_count between 0 and 200);
alter table businesses add column approved_at timestamptz;
alter table businesses add column admin_notes text;   -- your private notes, never shown to owner
-- Application detail fields (the "all fields" signup form)
alter table businesses add column owner_name    text check (owner_name is null or char_length(owner_name) <= 80);
alter table businesses add column owner_phone   text check (owner_phone is null or owner_phone ~ '^[0-9]{10,15}$');
alter table businesses add column address       text check (address is null or char_length(address) <= 300);
alter table businesses add column city          text check (city is null or char_length(city) <= 80);
alter table businesses add column pincode       text check (pincode is null or pincode ~ '^[0-9]{4,10}$');
alter table businesses add column gst_number    text check (gst_number is null or char_length(gst_number) <= 20); -- optional
alter table businesses add column opening_hours text check (opening_hours is null or char_length(opening_hours) <= 120); -- free text: "10am–11pm, closed Mon"
-- Existing pilot businesses: mark approved
update businesses set status = 'approved', approved_at = now() where is_active = true;
```

**Public gate:** a menu page is served ONLY when `status='approved'` AND `is_active=true`:

```sql
drop policy "public read businesses" on businesses;
create policy "public read businesses" on businesses
  for select using (status = 'approved' and is_active = true);
```

**Dashboard gate (NEW behavior):** owners can always *read* their own business row (needed to know their status), but the app only grants dashboard access when `status='approved'`. Pending/rejected/suspended owners see the corresponding lock screen (section 6.1). The Phase 2 "owner read own business" select policy already covers the read.
### 3.3 Feature flags

```sql
create table business_features (
  business_id uuid primary key references businesses(id) on delete cascade,
  ordering_enabled boolean not null default true,     -- off = view-only price list
  testimonials_enabled boolean not null default true,
  photos_enabled boolean not null default true,
  analytics_enabled boolean not null default false,
  tables_enabled boolean not null default true,       -- off = no table grid (bakery/parlour counter mode)
  max_menu_items int not null default 30,
  updated_at timestamptz default now()
);
alter table business_features enable row level security;
create policy "public read features" on business_features for select using (true);
-- Writes: admin only (service role). No owner write policy.
```

Item limit enforced at DB:

```sql
create or replace function enforce_item_limit()
returns trigger language plpgsql security definer as $$
declare cap int; cnt int;
begin
  select max_menu_items into cap from business_features where business_id = new.business_id;
  select count(*) into cnt from menu_items where business_id = new.business_id;
  if cap is not null and cnt >= cap then
    raise exception 'Menu item limit reached for your plan';
  end if;
  return new;
end $$;
create trigger trg_item_limit before insert on menu_items
for each row execute function enforce_item_limit();
```

Auto-create a `business_features` row when a business is created.
### 3.4 Orders — now with status, editing, and billing linkage

```sql
create table orders (
  id uuid primary key default gen_random_uuid(),
  short_id text unique not null,                -- e.g. 'A4X9' — shown in WhatsApp message + dashboard
  business_id uuid not null references businesses(id) on delete cascade,
  table_no text,                                -- null = counter/takeaway
  items jsonb not null,                         -- [{item_id, name, portion, qty, unit_price, line_total}]
  total numeric(10,2) not null check (total >= 0),
  note text check (note is null or char_length(note) <= 200),
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','billed')),
  source text not null default 'customer'
    check (source in ('customer','staff')),     -- staff = added manually from the table view
  bill_id uuid,                                 -- set when billed (FK added after bills table)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table orders enable row level security;
-- Customers (anon) can INSERT orders only for approved businesses with ordering enabled,
-- and only as pending/customer
create policy "public create order" on orders for insert with check (
  status = 'pending' and source = 'customer' and bill_id is null
  and business_id in (
    select b.id from businesses b
    join business_features f on f.business_id = b.id
    where b.status = 'approved' and b.is_active = true and f.ordering_enabled = true
  )
);
-- Owner reads own orders
create policy "owner read own orders" on orders
  for select using (business_id in (select id from businesses where owner_id = auth.uid()));
-- Owner can UPDATE own orders (approve/reject, edit items) and INSERT staff orders
create policy "owner update own orders" on orders
  for update using (business_id in (select id from businesses where owner_id = auth.uid()));
create policy "owner create staff order" on orders for insert
  with check (
    source = 'staff' and status = 'approved'
    and business_id in (select id from businesses where owner_id = auth.uid())
  );
-- No deletes for anyone via API (rejected orders stay as records).
```

**Order integrity trigger** — owners can edit, but within rules:

```sql
create or replace function protect_order_columns()
returns trigger language plpgsql security definer as $$
begin
  if is_admin() then return new; end if;
  -- Identity fields are frozen forever
  if new.business_id is distinct from old.business_id
  or new.short_id    is distinct from old.short_id
  or new.source      is distinct from old.source
  or new.created_at  is distinct from old.created_at then
    raise exception 'Order identity fields cannot be changed';
  end if;
  -- Billed orders are fully frozen (the bill is the financial record)
  if old.status = 'billed' then
    raise exception 'Billed orders cannot be modified';
  end if;
  -- Rejected orders can only stay rejected
  if old.status = 'rejected' and new.status is distinct from 'rejected' then
    raise exception 'Rejected orders cannot be reopened';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger trg_protect_order_columns
before update on orders
for each row execute function protect_order_columns();
```

`short_id`: 4 chars from `A-Z2-9` (no 0/O/1/I), server-generated, retry on collision.
**Realtime:** enable Supabase Realtime (postgres_changes) on the `orders` table. The business dashboard subscribes filtered by its `business_id`. RLS applies to realtime too — owners only receive their own rows.
### 3.5 Bills

```sql
create table bills (
  id uuid primary key default gen_random_uuid(),
  bill_no bigint generated always as identity,   -- human-friendly sequential number
  business_id uuid not null references businesses(id) on delete cascade,
  table_no text,
  items jsonb not null,        -- merged snapshot at billing time: [{name, portion, qty, unit_price, line_total}]
  subtotal numeric(10,2) not null check (subtotal >= 0),
  total numeric(10,2) not null check (total >= 0),   -- Phase 3: total = subtotal (taxes/discounts in Phase 4)
  order_ids uuid[] not null,   -- which orders were merged into this bill
  created_at timestamptz default now()
);
alter table orders add constraint orders_bill_fk
  foreign key (bill_id) references bills(id);
alter table bills enable row level security;
create policy "owner create bill" on bills for insert
  with check (business_id in (select id from businesses where owner_id = auth.uid()));
create policy "owner read own bills" on bills
  for select using (business_id in (select id from businesses where owner_id = auth.uid()));
create policy "admin read all bills" on bills for select using (is_admin());
-- Bills are immutable: no update/delete policies for anyone.
```

**Billing flow (transactional):** "Generate Bill" on a table → one server action: merge all `approved` unbilled orders for that table into a combined item snapshot (same item+portion lines summed) → insert `bills` row → set those orders `status='billed'`, `bill_id=<new bill>` → return bill for the print view. Run as a single RPC (`create_bill(business_id, table_no)` as a `security definer` Postgres function) so it's atomic — no half-billed states.
**Monthly revenue** (used by admin + owner analytics) = `sum(bills.total)` grouped by month. Rejected orders never count; unbilled approved orders are "open", not revenue.
### 3.6 Scan analytics

```sql
create table scan_events (
  id bigint generated always as identity primary key,
  business_id uuid not null references businesses(id) on delete cascade,
  table_no text,
  created_at timestamptz default now()
);
alter table scan_events enable row level security;
create policy "public insert scan" on scan_events for insert
  with check (business_id in (select id from businesses where status = 'approved' and is_active = true));
create policy "owner read own scans" on scan_events
  for select using (
    business_id in (select id from businesses where owner_id = auth.uid())
    and exists (select 1 from business_features f
                where f.business_id = scan_events.business_id and f.analytics_enabled = true)
  );
create policy "admin read all scans" on scan_events for select using (is_admin());
```

One event per menu page load, fire-and-forget, never delays rendering. No cookies/fingerprinting/personal data.
### 3.7 Admin audit log

```sql
create table audit_log (
  id bigint generated always as identity primary key,
  admin_user_id uuid not null,
  action text not null,      -- 'approve_business','reject_business','suspend_business','reactivate_business',
                             -- 'update_features','update_plan','generate_qr','link_owner',
                             -- 'delete_testimonial','update_business', ...
  target_type text not null,
  target_id text not null,
  detail jsonb,
  created_at timestamptz default now()
);
alter table audit_log enable row level security;  -- no policies: service-role only
```

Every admin mutation writes one row — enforced by the `adminAction` wrapper (4.2).
### 3.8 Trigger updates from Phase 2 (admin bypass + new protected columns)

```sql
create or replace function protect_business_columns()
returns trigger language plpgsql security definer as $$
begin
  if is_admin() then return new; end if;
  if new.owner_id    is distinct from old.owner_id
  or new.slug        is distinct from old.slug
  or new.is_active   is distinct from old.is_active
  or new.status      is distinct from old.status
  or new.plan        is distinct from old.plan
  or new.table_count is distinct from old.table_count
  or new.admin_notes is distinct from old.admin_notes
  or new.created_at  is distinct from old.created_at then
    raise exception 'This field cannot be changed from the dashboard';
  end if;
  return new;
end $$;
```

Add the same first line (`if is_admin() then return new; end if;`) to the Phase 2 testimonial and business_fk triggers. Service-role calls bypass RLS but NOT triggers — this line is what lets the admin panel work. The Phase 2 manual `disable trigger` onboarding snippet is now retired.
Admin read policies:

```sql
create policy "admin read all businesses"   on businesses   for select using (is_admin());
create policy "admin read all testimonials" on testimonials for select using (is_admin());
create policy "admin read all orders"       on orders       for select using (is_admin());
```

### 3.9 Signup application insert policy

```sql
-- New owners create their business ONLY as a pending application, linked to themselves,
-- one business per account (Phase 3 limit)
create policy "owner create pending business" on businesses for insert
  with check (
    owner_id = auth.uid()
    and status = 'pending'
    and is_active = true
    and not exists (select 1 from businesses b where b.owner_id = auth.uid())
  );
```

Slug auto-generated server-side from business name (`spice-garden`, `spice-garden-2` on collision). Owners never see or choose slugs.
---
## 4. Admin panel (`/admin`)
### 4.1 Admin auth
- Same email OTP login as owners; users present in `admin_users` may access `/admin`
- `/admin/**` guard: session + `is_admin()` verified server-side on every request; non-admins get a plain 404 (don't reveal the panel exists)
- Desktop-first, must not break on mobile
### 4.2 Admin server-action pattern (every mutation)

```
1. Session → admin_users lookup → not admin? 404
2. zod-validate input
3. Mutation (service role client)
4. audit_log row
5. Return
```

One `adminAction(...)` wrapper makes steps 1 and 4 impossible to skip.
### 4.3 Admin screens
**Dashboard (home) — "all business data, properly organized":**
- Action row: **pending applications count** (big, first, clickable)
- Platform stat cards: active businesses, suspended, orders today, bills today, **revenue this month (₹, sum of all bills)**
- Charts (recharts): orders + revenue last 30 days (platform-wide); top 10 businesses by revenue this month (bar)
- "Needs attention" list: businesses with zero scans in 14 days (churn risk), businesses at their item cap (upsell)
**Inquiry queue (applications):**
- Pending businesses, newest first — each card shows the FULL application: business name, type, logo, owner name, owner phone, owner email, WhatsApp number, address, city, pincode, GST (if given), opening hours
- **Approve** → dialog: set plan (free/basic/premium preset) + table_count → status='approved', approved_at=now(). Owner's next login opens the dashboard.
- **Reject** → dialog: reason (saved to admin_notes) → status='rejected'. Owner's next login shows the rejected screen with the support email.
- Both audited.
**Businesses list:** searchable, filterable by status/plan/city. Columns: name, city, plan, status, owner, tables, orders this month, revenue this month. Row → business detail.
**Business detail (the control room):**
- **Status controls:** Approve / Suspend (reason → admin_notes) / Reactivate / Reject — instant effect on public page and owner login; all audited
- **Application info panel:** every field from the signup form, editable by admin (fix typos, update phone)
- **Owner:** linked owner email; re-link by email lookup if they change accounts
- **Plan & features:** plan presets + individual switches (`ordering_enabled`, `testimonials_enabled`, `photos_enabled`, `analytics_enabled`, `tables_enabled`) + `max_menu_items`. Presets: free = ordering+testimonials+tables on, photos+analytics off, 30 items; basic = photos on, 100 items; premium = all on, 500 items.
- **QR section (admin-only):** set table_count → "Generate QR PDF" → A4 pack: one card per table (QR = `https://<domain>/m/<slug>?table=N`, business name, "Table N", "Scan to view menu & order") + one no-table counter card. Deterministic QRs — reprints always match. Owners have zero QR access; their dashboard says "Contact us for QR reprints."
- **Orders tab:** this business's orders, filterable by status/date; each shows short_id, table, items, total, status timeline
- **Bills & revenue tab:** bills list (bill_no, table, total, time) + monthly revenue chart for this business + this month / last month totals
- **Menu preview:** read-only live menu + public link
- **Testimonials:** all including rejected; admin hard-DELETE for legal/abuse (the only delete path in the system; audited with full text in `detail`)
- **Scans:** per-table scan counts, last 30 days
- **Admin notes:** free text only you see
**Audit log screen:** filterable by admin, action, target; read-only.
---
## 5. Signup & login flow (owner side) — the approval gate
### 5.1 New owner signup (`/signup`)
Single application form, all fields, in this order:
1. **Account:** email (OTP verification right here — verify the email before the application is accepted)
2. **Business info:** business name*, type* (restaurant/parlour/bakery/other), tagline, logo upload*, WhatsApp number* (with the format validation from Phase 2), opening hours
3. **Location:** address*, city*, pincode*
4. **Owner info:** owner full name*, owner phone*
5. **Optional:** GST number
6. Submit → creates the pending business (policy 3.9) → success screen: *"Application received! We review every business personally. You'll be able to log in once approved. Questions: support@YOURDOMAIN.com"*
Logo upload at signup: allowed pre-approval — compress client-side as in Phase 2, store under `business-assets/<business_id>/logo.webp` (the storage policy from Phase 2 already scopes it to their own folder).
### 5.2 Login (`/login`) — unchanged mechanics, new gate
After OTP succeeds, route by business status:
- **approved** → `/dashboard` (normal, as Phase 2)
- **pending** → lock screen: *"Your application is under review. We'll approve it shortly. Contact: support@YOURDOMAIN.com"* — no dashboard, no menu editing
- **rejected** → lock screen: *"Your application was not approved. Contact: support@YOURDOMAIN.com"*
- **suspended** → lock screen: *"Your account is suspended and your page is offline. Contact: support@YOURDOMAIN.com"*
- **no business at all** → redirect to `/signup`
The lock screens have exactly two actions: contact support (mailto) and log out. Enforce in the `/dashboard` layout guard server-side — not just a client redirect.
---
## 6. Business dashboard additions (owner side)
Tab bar becomes: **Tables · Orders · Menu · Reviews · Settings** (Tables hidden when `tables_enabled=false`; Reviews hidden when `testimonials_enabled=false`).
### 6.1 Tables tab — the live grid (the owner's main screen during service)
- Grid of tiles: Table 1 … Table N (from `table_count`) + one "Counter" tile for table-less orders
- **Tile states:**
  - **Empty** (no open orders): grey, just the table number
  - **New order waiting** (any `pending` order on this table): highlighted + badge with pending count — this is the "first approve or reject" step
  - **Occupied** (approved unbilled orders): colored tile showing the **running total amount** on the tile (e.g. "Table 5 — ₹510")
- Realtime: new customer orders appear on the grid within ~1–2 seconds via the Supabase Realtime subscription; play a short notification sound + browser tab title flash ("● New order")
- Tapping a tile with pending orders → approve/reject sheet first (see each order's items, total, note, time, short_id); Approve adds it to the table's running total; Reject removes it (record kept, status='rejected')
- Tapping an occupied tile → **Table detail view (6.2)**
### 6.2 Table detail view (mini-POS)
- Header: table number, time since first approved order, combined running total
- **Combined item list** across all approved unbilled orders on this table (same item+portion merged): name, portion, unit price, qty with **+ / − steppers**, line total
  - − to zero removes the line
  - Every manual change updates the underlying order rows (server action; the 3.4 trigger keeps identity fields frozen)
- **"+ Add item"** → searchable picker of the business's own menu (staff adds what the customer ordered verbally) → creates a `source='staff'`, `status='approved'` order
- Per-order history strip below (collapsed): each order's short_id, time, source (customer/staff), original items — so disputes can be settled ("your phone order #A4X9 was 2 biryanis")
- **"Generate Bill"** button → runs the atomic `create_bill` RPC (3.5) → opens the **bill print view**
- Empty-table state: just "+ Add item" (walk-ins who order verbally without scanning)
### 6.3 Bill print view
- Clean receipt: business name + logo, address, GST number (if set), bill_no, date/time, table, item lines, subtotal, total, "Thank you!" footer
- **Print button** → `window.print()` with print CSS: 80mm thermal width layout by default, A4 fallback — works with any browser-connected printer, no printer SDK
- After billing, the table tile resets to Empty
- Past bills reachable from the Orders tab (reprint anytime)
### 6.4 Orders tab (history + audit)
- Newest-first list of ALL orders: short_id, time, table, source, items, total, status chip (pending/approved/rejected/billed)
- Filters: status, date, table
- Bills sub-list: bill_no, table, total, time → reopen print view
- Banner at top: *"Customers can edit the WhatsApp message text. THIS list is the real order — match the Order ID (#A4X9) from the message."*
### 6.5 Analytics mini-cards (when `analytics_enabled=true`)
Scans this week, orders this week, revenue this month (from bills), busiest table. One small recharts line for the last 30 days.
---
## 7. Customer-side changes (public page)
1. **Gate:** non-approved/inactive business → friendly offline page ("This menu isn't available right now.") — identical page for pending/suspended/rejected/unknown slug; reveal nothing.
2. **Scan tracking:** fire-and-forget insert per page load; never blocks rendering.
3. **Order flow:** checkout → server inserts the order (status='pending') → gets `short_id` → WhatsApp message now includes `Order ID: #A4X9` as line 2 → redirect to `wa.me` as before. The customer experience is unchanged; the order simultaneously appears on the owner's table grid. If the insert fails, still redirect to WhatsApp without the ID line — never block a real order.
4. **Post-checkout state:** "Order sent! The restaurant will confirm shortly. Your order ID: #A4X9."
5. **Feature respect:** `ordering_enabled=false` → view-only price list (no cart); `testimonials_enabled=false` → no reviews section/form; `photos_enabled=false` → text-only cards.
---
## 8. Security test suite (plus re-run the full Phase 2 suite)
**Admin boundary:**
1. Non-admin hitting `/admin` (UI and direct server-action calls) → 404, zero admin data leaked
2. Owner cannot insert into `admin_users`
3. Owner cannot change own `status`, `plan`, `table_count`, `admin_notes` (trigger)
4. Admin CAN change protected columns; every change lands in `audit_log`
**Approval gate:**
5. Pending owner: OTP login succeeds but dashboard is locked (server-side — direct navigation to `/dashboard/...` routes also blocked); public page offline
6. Rejected and suspended owners: correct lock screens; suspended business's public page dark on next load
7. Owner cannot create a second business; cannot insert with `status='approved'`
**Orders & bills:**
8. Anon can insert orders only as pending/customer and only for approved+ordering-enabled businesses; anon cannot insert for a suspended business or when `ordering_enabled=false`
9. Owner A cannot read/update Owner B's orders or bills (RLS)
10. Billed order rejected on any update; rejected order cannot be reopened; `business_id`/`short_id`/`source` frozen on all orders (trigger)
11. Bills immutable: update/delete attempts fail for owner and anon
12. `create_bill` is atomic: kill the request mid-flight in testing → either full bill + all orders billed, or nothing
13. Realtime: Owner A's dashboard subscription never receives Owner B's order events
**Feature flags:**
14. `max_menu_items` enforced at DB (item #cap+1 fails even via direct API)
15. `analytics_enabled=false` → owner cannot select own scan_events
**Content/audit:**
16. Admin testimonial delete works, is audited with full text; owners still cannot delete
17. Every admin mutation type produces exactly one audit row; audit_log unreadable by owners/anon
**Gap-closers (section 10):**
18. `accepting_orders=false` → anon order insert fails at DB; customer page shows the closed banner
19. 4th pending customer order on the same table fails at DB; staff orders unaffected by the cap
20. Duplicate `client_key` insert fails (idempotency); double-tapping checkout produces exactly one order
21. Bill void: only false→true with reason succeeds; editing totals/items fails; voiding a voided bill fails; >24h void fails for owner; voided bills excluded from every revenue figure
22. Owner cannot change `is_demo`; demo business excluded from platform revenue/stats
---
## 9. Acceptance checklist
1. New owner: `/signup` full application with logo → success screen → login shows PENDING lock screen with support email
2. Admin: inquiry appears in queue with all fields → Approve (plan basic, 10 tables) → owner's next login opens the dashboard; public page live
3. Admin: generate QR PDF → scan with a real phone → menu opens with correct table badge
4. Customer places order from Table 5 → within ~2s the tile lights up with a pending badge + sound → owner approves → "Table 5 — ₹510" on the tile → WhatsApp message on the customer's phone carries the same order ID
5. Table detail: +/− quantities, add a staff item via picker → total updates → Generate Bill → print view renders correctly in 80mm print preview → table resets to empty → bill reachable and reprintable from Orders tab
6. Reject flow: a pending order rejected never appears in the table total and stays visible in history as rejected
7. Admin business detail shows this order, this bill, and this month's revenue; admin home shows platform revenue and top-businesses chart
8. Suspend the business → owner locked out, public page dark, order inserts fail; Reactivate → all restored
9. Feature flags: ordering off → view-only page; tables off → Tables tab gone; item cap enforced at DB
10. Full security suite (section 8) + re-run of Phase 2's 16 tests pass
11. Audit log contains a complete history of every admin action taken during this checklist
12. Tables grid + table detail comfortably usable on a phone (owners run service from their phone)
13. Gap-closers work end-to-end: close orders → banner appears → reopen; spam a 4th pending order → blocked with friendly message; double-tap checkout → one order; bill a table → void with reason → VOID stamp on reprint and revenue unchanged; export a month's bills as CSV; fresh approved owner sees the onboarding checklist; demo business orders don't appear in platform revenue; privacy/terms reachable from signup and menu footer; search filters a long menu instantly
---
## 10. Gap-closers (in scope — found in final review)
These are small features individually, but each one prevents a real-world failure. Build them all.
### 10.1 "Accepting orders" master switch (prevents the 2 AM ghost order)
Without this, a customer who saved the link can place an order at 2 AM when the restaurant is closed — it sits pending all night and the customer waits for food that never comes.

```sql
alter table businesses add column accepting_orders boolean not null default true;
```

- Owner-editable (Settings tab AND a prominent switch on the Tables tab header: "Accepting orders ●")
- NOT in the protected-columns trigger list — owners flip this freely, many times a day
- Enforce at DB: amend the `public create order` policy (3.4) to also require `b.accepting_orders = true`
- Customer page when off: menu fully browsable, but the cart/checkout is replaced with a banner — *"Currently closed. We're not taking orders right now."* (opening_hours text shown if set)
- Owner closing routine = one tap when they shut for the night
### 10.2 Order flood control (prevents table-grid spam)
Anonymous inserts are open by design, so one prankster could dump 50 pending orders onto Table 5. Cap it at the database:

```sql
create or replace function enforce_pending_cap()
returns trigger language plpgsql security definer as $$
declare cnt int;
begin
  if new.source = 'customer' then
    select count(*) into cnt from orders
    where business_id = new.business_id
      and coalesce(table_no,'') = coalesce(new.table_no,'')
      and status = 'pending';
    if cnt >= 3 then
      raise exception 'Too many pending orders for this table. Please wait for the restaurant to confirm.';
    end if;
  end if;
  return new;
end $$;
create trigger trg_pending_cap before insert on orders
for each row execute function enforce_pending_cap();
```

Customer page shows the error message as a friendly toast. Three pending orders per table is generous for real usage and useless for spam.
### 10.3 Double-tap protection (prevents duplicate orders)
Nervous customers tap "Place Order" twice → two identical orders → kitchen makes double food. Two layers:
- Client: disable the checkout button immediately on first tap
- Server: client generates a UUID per checkout attempt, sent as `client_key`; add `alter table orders add column client_key uuid unique;` — the second insert fails on the unique constraint and the client treats that as success (idempotency)
### 10.4 Bill void (mistakes happen — amends the "immutable bills" rule in 3.5)
Wrong table billed, wrong items — real restaurants void bills; they don't pretend mistakes don't exist. Voiding keeps the record but removes it from revenue:

```sql
alter table bills add column is_void boolean not null default false;
alter table bills add column void_reason text check (void_reason is null or char_length(void_reason) <= 200);
alter table bills add column voided_at timestamptz;
create policy "owner void own bill" on bills for update
  using (business_id in (select id from businesses where owner_id = auth.uid()));
create or replace function protect_bill_columns()
returns trigger language plpgsql security definer as $$
begin
  if is_admin() then return new; end if;
  -- The ONLY permitted change: false → true with a reason, within 24h of creation
  if old.is_void = true then raise exception 'Voided bills cannot be changed'; end if;
  if new.is_void is distinct from true
  or new.void_reason is null
  or new.items is distinct from old.items
  or new.subtotal is distinct from old.subtotal
  or new.total is distinct from old.total
  or new.business_id is distinct from old.business_id
  or new.order_ids is distinct from old.order_ids
  or new.created_at is distinct from old.created_at then
    raise exception 'Bills can only be voided (with a reason), never edited';
  end if;
  if old.created_at < now() - interval '24 hours' then
    raise exception 'Bills older than 24 hours can only be voided by support';
  end if;
  new.voided_at := now();
  return new;
end $$;
create trigger trg_protect_bill_columns before update on bills
for each row execute function protect_bill_columns();
```

- Void button on the bill view → reason dialog → bill shows a red **VOID** stamp (including on reprint)
- ALL revenue queries (owner analytics, admin dashboards) filter `is_void = false`
- Voided bills stay visible in lists (struck through) — hiding them invites abuse; admin sees void counts per business (a business voiding constantly is a signal worth a call)
### 10.5 Owner CSV export (their accountant will ask in month one)
Orders tab gets "Export CSV" for bills (bill_no, date, table, items summary, total, void status) and orders, filtered by the selected month. Client-side CSV generation from already-fetched data — no server work.
### 10.6 Post-approval onboarding checklist (activation)
An approved owner with an empty menu is a dead account. First dashboard visit shows a dismissible checklist banner:
1. Add at least 5 menu items → 2. Send the WhatsApp test message (Settings) → 3. Open your live page
Each item checks off automatically. Gone once completed or dismissed.
### 10.7 Demo business (your sales weapon)

```sql
alter table businesses add column is_demo boolean not null default false;  -- admin-only, protected column
```

Admin flags one fully-loaded fake restaurant as demo. You walk into a prospect's shop, they scan YOUR demo QR, order from their own phone, and watch it hit your table grid live. Demo businesses are excluded from all platform revenue/stats. (Add `is_demo` to the protected-columns trigger list in 3.8.)
### 10.8 Legal pages (you're collecting personal data now)
You store owner names, phones, addresses, and customer names in reviews — in India, the DPDP Act applies to you. Static `/privacy` and `/terms` pages; signup gains a checkbox line: *"By applying you agree to the Terms and Privacy Policy."* Footer links on the public menu page. Get the actual text reviewed properly before scale — placeholder text is fine for the pilot, not for 10k businesses.
### 10.9 Customer menu search (long menus)
A search box above the category pills, client-side filter on item name — restaurants with 80+ items need it, costs almost nothing.
---
## 11. Suggested Claude Code prompt sequence
1. "Read PHASE3_SPEC.md. Produce the complete section 3 SQL as one ordered migration (admin role, application fields+statuses, features, orders+trigger, bills+create_bill RPC, scans, audit, trigger replacements, policies, realtime enablement notes)."
2. "Set up the server-only service-role client, the is_admin guard for /admin, and the adminAction wrapper with mandatory audit logging (4.2)."
3. "Build /signup per 5.1 (full application form with logo upload and slug auto-generation) and the login routing + lock screens per 5.2, enforced server-side in the dashboard layout."
4. "Build the admin Inquiry queue and Businesses list + Business detail with status controls, application info panel, and owner linking (4.3)."
5. "Add plan presets, feature switches, max_menu_items, and the QR PDF generation to Business detail."
6. "Implement customer-side changes per section 7: offline gate, scan tracking, order insert with short_id in the WhatsApp message, feature respect."
7. "Build the owner Tables grid with Supabase Realtime, pending approve/reject flow, and running totals per 6.1."
8. "Build the Table detail mini-POS per 6.2: merged items, +/− editing, staff add-item picker, order history strip."
9. "Implement the atomic create_bill RPC and the bill print view with 80mm thermal + A4 print CSS per 6.3, plus the Orders tab per 6.4."
10. "Build admin Dashboard home (platform stats, revenue charts, needs-attention list), per-business Orders and Bills & revenue tabs, testimonial hard-delete, and the audit log screen."
11. "Implement ALL gap-closers from section 10: accepting-orders switch + policy amendment, pending cap trigger, client_key idempotency, bill void with trigger + VOID print stamp + revenue filters, CSV export, onboarding checklist, is_demo flag with stat exclusion, legal pages + signup checkbox, menu search."
12. "Add owner analytics mini-cards (6.5). Then run the full section 8 security suite AND re-run the Phase 2 suite, then the section 9 checklist. Show results as a table and fix all failures."
---
## 12. After Phase 3 — you now run a real platform
Your daily loop:
- Application arrives → review all details → approve + set plan + table count → generate + deliver QR pack → owner goes live
- Owner runs service from the table grid; you see their orders, bills, and revenue in your admin panel
- Payment stops → Suspend (page dark + owner locked out) → payment resumes → Reactivate
- Sales pitch: show a live client's real scan/order/revenue numbers
**Phase 4 candidates (rough priority):**
1. **Your marketing website** — landing page at your root domain: what the product does, live demo QR to scan, pricing plans, `platform_reviews` (testimonials FROM business owners about YOUR product, admin-moderated), and a "Get started" button into `/signup`. Until now every phase built the product; this sells it. Should be the FIRST thing after Phase 3.
2. Automated billing (Razorpay subscriptions) driving auto-suspend/reactivate
3. Taxes & discounts on bills (GST lines, service charge) + daily sales report for owners
4. Owner notifications (email/WhatsApp) on approve/suspend + a fallback alert when a pending order sits unseen for 5+ minutes (realtime only works while the dashboard tab is open — the WhatsApp message is the safety net today, an explicit alert is better)
5. Customer order-status page — the post-checkout screen polls the order by short_id and shows "✓ Confirmed by the restaurant" when approved (closes the loop for the customer)
6. "Call waiter" button on the menu page (rings the table grid; cheap to build on the existing realtime channel, strong differentiator)
7. Staff logins / waiter PINs per business (so the owner's account isn't shared) + kitchen display mode
8. Multi-language menus (Hindi/Telugu/regional — big for your market)
9. Item variants beyond Half/Full (Small/Medium/Large, add-ons)
10. Multi-admin staff roles (audit log is ready)
11. Custom domains / white-label for premium clients
