-- ============================================================================
-- Phase 3 — Admin control + live order management (PHASE3_SPEC.md section 3
-- + gap-closer SQL from section 10, as ONE ordered migration).
--
-- Run this whole file ONCE per Supabase project (dev first, then prod),
-- AFTER: schema.sql, phase2_auth.sql, reviews_policy.sql, reviews_cleanup.sql,
-- storage.sql. Then do the two manual steps at the bottom.
--
-- Deviation from spec (deliberate): our Admin app authenticates with the
-- service-role key, where auth.uid() IS NULL — so the spec's `is_admin()`
-- trigger bypass would never fire for it. `is_privileged()` below also lets
-- service_role (and SQL-editor/postgres) through. RLS is already bypassed by
-- service_role; this only affects triggers.
-- ============================================================================

-- ── 3.1 Admin role ──────────────────────────────────────────────────────────

create table if not exists admin_users (
  user_id uuid primary key references auth.users(id),
  created_at timestamptz default now()
);
alter table admin_users enable row level security;
-- No policies = unreachable via anon/authenticated keys.

-- Per-admin ROLES (plural) for the Admin site's RBAC. Any row = can sign into
-- /admin; a user can hold several roles (see Admin/lib/roles.ts). superadmin
-- implies everything. Migrates the earlier single-role column if present.
alter table admin_users add column if not exists roles text[] not null default array['admin']::text[];
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_name = 'admin_users' and column_name = 'role') then
    update admin_users set roles = array[role];
    alter table admin_users drop column role;
  end if;
end $$;
alter table admin_users drop constraint if exists admin_users_roles_valid;
alter table admin_users add constraint admin_users_roles_valid check (
  roles <> '{}' and roles <@ array[
    'superadmin', 'admin', 'snap_manager',
    'snap_sales_manager', 'snap_sales_member', 'snap_employee',
    'analytics_revenue', 'analytics_users'
  ]::text[]
);

create or replace function is_admin()
returns boolean language sql security definer stable as $$
  select exists (select 1 from admin_users where user_id = auth.uid());
$$;

-- True for admin JWTs, the service-role key, and direct SQL (postgres).
create or replace function is_privileged()
returns boolean language sql security definer stable as $$
  select is_admin()
      or coalesce(auth.role(), 'postgres') not in ('anon', 'authenticated');
$$;

-- ── 3.2 Business lifecycle + application fields (+10.1, 10.7) ───────────────

alter table businesses add column if not exists status text not null default 'pending'
  check (status in ('pending','approved','suspended','rejected'));
alter table businesses add column if not exists plan text not null default 'free'
  check (plan in ('free','basic','premium'));
alter table businesses add column if not exists table_count int not null default 0
  check (table_count between 0 and 200);
alter table businesses add column if not exists approved_at timestamptz;
alter table businesses add column if not exists admin_notes text;
alter table businesses add column if not exists owner_name    text check (owner_name is null or char_length(owner_name) <= 80);
alter table businesses add column if not exists owner_phone   text check (owner_phone is null or owner_phone ~ '^[0-9]{10,15}$');
alter table businesses add column if not exists address       text check (address is null or char_length(address) <= 300);
alter table businesses add column if not exists city          text check (city is null or char_length(city) <= 80);
alter table businesses add column if not exists pincode       text check (pincode is null or pincode ~ '^[0-9]{4,10}$');
alter table businesses add column if not exists gst_number    text check (gst_number is null or char_length(gst_number) <= 20);
alter table businesses add column if not exists opening_hours text check (opening_hours is null or char_length(opening_hours) <= 120);
alter table businesses add column if not exists accepting_orders boolean not null default true; -- 10.1
alter table businesses add column if not exists is_demo boolean not null default false;         -- 10.7

-- One-time backfill: pilot businesses that exist today were onboarded by the
-- admin manually — approve them so they keep working.
update businesses set status = 'approved', approved_at = now()
  where is_active = true and status = 'pending' and owner_id is not null;

-- Public gate: menu served ONLY when approved AND active.
drop policy if exists "public read businesses" on businesses;
create policy "public read businesses" on businesses
  for select using (status = 'approved' and is_active = true);

-- Owners always read their own row (drives the lock screens).
drop policy if exists "owner read own business" on businesses;
create policy "owner read own business" on businesses
  for select to authenticated using (owner_id = auth.uid());

-- 3.9 Signup application insert policy (one business per account).
drop policy if exists "owner insert own business" on businesses;
drop policy if exists "owner create pending business" on businesses;
create policy "owner create pending business" on businesses for insert
  with check (
    owner_id = auth.uid()
    and status = 'pending'
    and is_active = true
    and not exists (select 1 from businesses b where b.owner_id = auth.uid())
  );
-- Belt & suspenders against races on the "one business" rule:
create unique index if not exists one_business_per_owner
  on businesses(owner_id) where owner_id is not null;

-- 3.8 Protected columns: owners can never touch these (admin/service can).
create or replace function protect_business_columns()
returns trigger language plpgsql security definer as $$
begin
  if is_privileged() then return new; end if;
  if new.owner_id    is distinct from old.owner_id
  or new.slug        is distinct from old.slug
  or new.is_active   is distinct from old.is_active
  or new.status      is distinct from old.status
  or new.plan        is distinct from old.plan
  or new.table_count is distinct from old.table_count
  or new.admin_notes is distinct from old.admin_notes
  or new.approved_at is distinct from old.approved_at
  or new.is_demo     is distinct from old.is_demo
  or new.created_at  is distinct from old.created_at then
    raise exception 'This field cannot be changed from the dashboard';
  end if;
  return new;
end $$;
drop trigger if exists trg_protect_business_columns on businesses;
create trigger trg_protect_business_columns
  before update on businesses
  for each row execute function protect_business_columns();

-- ── 3.3 Feature flags ───────────────────────────────────────────────────────

create table if not exists business_features (
  business_id uuid primary key references businesses(id) on delete cascade,
  ordering_enabled boolean not null default true,
  testimonials_enabled boolean not null default true,
  photos_enabled boolean not null default true,
  analytics_enabled boolean not null default false,
  tables_enabled boolean not null default true,
  max_menu_items int not null default 30,
  updated_at timestamptz default now()
);
-- Admin grants an owner the ability to download their own QR pack (default off:
-- QR codes are admin-issued; this opt-in lets trusted owners self-serve).
alter table business_features add column if not exists qr_download_enabled boolean not null default false;
alter table business_features enable row level security;
drop policy if exists "public read features" on business_features;
create policy "public read features" on business_features for select using (true);
-- Writes: admin/service-role only. No owner write policy.

-- Auto-create a features row for every new business.
create or replace function create_default_features()
returns trigger language plpgsql security definer as $$
begin
  insert into business_features (business_id) values (new.id)
  on conflict (business_id) do nothing;
  return new;
end $$;
drop trigger if exists trg_default_features on businesses;
create trigger trg_default_features
  after insert on businesses
  for each row execute function create_default_features();

-- Backfill features for existing businesses.
insert into business_features (business_id)
  select id from businesses
  on conflict (business_id) do nothing;

-- Item limit enforced at the database.
create or replace function enforce_item_limit()
returns trigger language plpgsql security definer as $$
declare cap int; cnt int;
begin
  if is_privileged() then return new; end if;
  select max_menu_items into cap from business_features where business_id = new.business_id;
  select count(*) into cnt from menu_items where business_id = new.business_id;
  if cap is not null and cnt >= cap then
    raise exception 'Menu item limit reached for your plan';
  end if;
  return new;
end $$;
drop trigger if exists trg_item_limit on menu_items;
create trigger trg_item_limit before insert on menu_items
  for each row execute function enforce_item_limit();

-- ── 3.4 Orders (+10.2 pending cap, +10.3 client_key) ────────────────────────

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  short_id text unique not null,
  business_id uuid not null references businesses(id) on delete cascade,
  table_no text,
  items jsonb not null,
  total numeric(10,2) not null check (total >= 0),
  note text check (note is null or char_length(note) <= 200),
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','billed')),
  source text not null default 'customer'
    check (source in ('customer','staff')),
  bill_id uuid,
  client_key uuid unique,                       -- 10.3 idempotency
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists orders_business_status_idx on orders(business_id, status);
create index if not exists orders_business_table_idx on orders(business_id, table_no);
alter table orders enable row level security;

drop policy if exists "public create order" on orders;
create policy "public create order" on orders for insert with check (
  status = 'pending' and source = 'customer' and bill_id is null
  and business_id in (
    select b.id from businesses b
    join business_features f on f.business_id = b.id
    where b.status = 'approved' and b.is_active = true
      and b.accepting_orders = true               -- 10.1
      and f.ordering_enabled = true
  )
);
drop policy if exists "owner read own orders" on orders;
create policy "owner read own orders" on orders
  for select using (business_id in (select id from businesses where owner_id = auth.uid()));
drop policy if exists "owner update own orders" on orders;
create policy "owner update own orders" on orders
  for update using (business_id in (select id from businesses where owner_id = auth.uid()));
drop policy if exists "owner create staff order" on orders;
create policy "owner create staff order" on orders for insert
  with check (
    source = 'staff' and status = 'approved'
    and business_id in (select id from businesses where owner_id = auth.uid())
  );
drop policy if exists "admin read all orders" on orders;
create policy "admin read all orders" on orders for select using (is_admin());
-- No deletes for anyone via API.

create or replace function protect_order_columns()
returns trigger language plpgsql security definer as $$
begin
  if is_privileged() then
    new.updated_at := now();
    return new;
  end if;
  if new.business_id is distinct from old.business_id
  or new.short_id    is distinct from old.short_id
  or new.source      is distinct from old.source
  or new.created_at  is distinct from old.created_at then
    raise exception 'Order identity fields cannot be changed';
  end if;
  if old.status = 'billed' then
    raise exception 'Billed orders cannot be modified';
  end if;
  if old.status = 'rejected' and new.status is distinct from 'rejected' then
    raise exception 'Rejected orders cannot be reopened';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_protect_order_columns on orders;
create trigger trg_protect_order_columns
  before update on orders
  for each row execute function protect_order_columns();

-- 10.2 Order flood control: max 3 pending customer orders per table.
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
drop trigger if exists trg_pending_cap on orders;
create trigger trg_pending_cap before insert on orders
  for each row execute function enforce_pending_cap();

-- Realtime: owner dashboards subscribe to their own orders.
do $$
begin
  alter publication supabase_realtime add table orders;
exception when duplicate_object then null;
end $$;

-- Customer order placement RPC (security definer): the anon role has NO select
-- policy on orders (only owners/admins read them), so a direct
-- `insert ... returning short_id` from the public menu fails the read-back.
-- This function inserts and returns the short_id, re-checking the same gate as
-- the "public create order" policy so security is preserved. Idempotent on
-- client_key (double-tap / network retry safe); the pending-cap trigger still
-- fires and the flood-control message propagates to the caller.
create or replace function place_order(
  p_business_id uuid,
  p_table_no text,
  p_items jsonb,
  p_total numeric,
  p_note text,
  p_client_key uuid
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean;
  v_short text;
  v_existing text;
  i int;
begin
  -- Idempotency: an identical prior request already placed this order.
  if p_client_key is not null then
    select short_id into v_existing from orders where client_key = p_client_key;
    if v_existing is not null then return v_existing; end if;
  end if;

  -- Same gate as the public insert policy: approved + active + open + ordering on.
  select exists (
    select 1 from businesses b
    join business_features f on f.business_id = b.id
    where b.id = p_business_id
      and b.status = 'approved' and b.is_active = true
      and b.accepting_orders = true and f.ordering_enabled = true
  ) into v_ok;
  if not v_ok then
    raise exception 'This business is not taking orders right now.'
      using errcode = 'P0001';
  end if;

  -- Insert; retry on the (rare) short_id collision.
  for i in 1..8 loop
    v_short := (
      select string_agg(
        substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
               floor(random() * 32)::int + 1, 1), '')
      from generate_series(1, 4)
    );
    begin
      insert into orders (short_id, business_id, table_no, items, total, note,
                          client_key, status, source)
      values (v_short, p_business_id, p_table_no, p_items, p_total, p_note,
              p_client_key, 'pending', 'customer');
      return v_short;
    exception when unique_violation then
      -- client_key race → return the winner; else short_id clash → loop.
      if p_client_key is not null then
        select short_id into v_existing from orders where client_key = p_client_key;
        if v_existing is not null then return v_existing; end if;
      end if;
    end;
  end loop;
  raise exception 'Could not place the order. Please try again.'
    using errcode = 'P0001';
end $$;

grant execute on function place_order(uuid, text, jsonb, numeric, text, uuid)
  to anon, authenticated;

-- ── 3.5 Bills (+10.4 void) ──────────────────────────────────────────────────

create table if not exists bills (
  id uuid primary key default gen_random_uuid(),
  bill_no bigint generated always as identity,
  business_id uuid not null references businesses(id) on delete cascade,
  table_no text,
  items jsonb not null,
  subtotal numeric(10,2) not null check (subtotal >= 0),
  total numeric(10,2) not null check (total >= 0),
  order_ids uuid[] not null,
  is_void boolean not null default false,        -- 10.4
  void_reason text check (void_reason is null or char_length(void_reason) <= 200),
  voided_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists bills_business_created_idx on bills(business_id, created_at);

do $$
begin
  alter table orders add constraint orders_bill_fk foreign key (bill_id) references bills(id);
exception when duplicate_object then null;
end $$;

alter table bills enable row level security;
drop policy if exists "owner create bill" on bills;
create policy "owner create bill" on bills for insert
  with check (business_id in (select id from businesses where owner_id = auth.uid()));
drop policy if exists "owner read own bills" on bills;
create policy "owner read own bills" on bills
  for select using (business_id in (select id from businesses where owner_id = auth.uid()));
drop policy if exists "admin read all bills" on bills;
create policy "admin read all bills" on bills for select using (is_admin());
drop policy if exists "owner void own bill" on bills;
create policy "owner void own bill" on bills for update
  using (business_id in (select id from businesses where owner_id = auth.uid()));

-- 10.4 Bills can only ever be voided (false→true, with reason, within 24h).
create or replace function protect_bill_columns()
returns trigger language plpgsql security definer as $$
begin
  if is_privileged() then return new; end if;
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
drop trigger if exists trg_protect_bill_columns on bills;
create trigger trg_protect_bill_columns before update on bills
  for each row execute function protect_bill_columns();

-- Atomic billing: merge approved unbilled orders for a table into one bill.
create or replace function create_bill(p_business_id uuid, p_table_no text)
returns bills language plpgsql security definer as $$
declare
  v_order_ids uuid[];
  v_items jsonb;
  v_subtotal numeric(10,2);
  v_bill bills;
begin
  if not (
    exists (select 1 from businesses where id = p_business_id and owner_id = auth.uid())
    or is_privileged()
  ) then
    raise exception 'Not authorized';
  end if;

  -- Lock the rows so two simultaneous taps cannot double-bill.
  v_order_ids := array(
    select id from orders
    where business_id = p_business_id
      and coalesce(table_no,'') = coalesce(p_table_no,'')
      and status = 'approved' and bill_id is null
    for update
  );
  if coalesce(array_length(v_order_ids, 1), 0) = 0 then
    raise exception 'No approved orders to bill for this table';
  end if;

  with lines as (
    select i->>'name' as name,
           nullif(i->>'portion','') as portion,
           (i->>'unit_price')::numeric as unit_price,
           sum((i->>'qty')::int) as qty
    from orders o
    cross join lateral jsonb_array_elements(o.items) i
    where o.id = any(v_order_ids)
    group by 1, 2, 3
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', name, 'portion', portion, 'qty', qty,
           'unit_price', unit_price, 'line_total', qty * unit_price)
           order by name), '[]'::jsonb),
         coalesce(sum(qty * unit_price), 0)
    into v_items, v_subtotal
  from lines;

  insert into bills (business_id, table_no, items, subtotal, total, order_ids)
  values (p_business_id, p_table_no, v_items, v_subtotal, v_subtotal, v_order_ids)
  returning * into v_bill;

  update orders set status = 'billed', bill_id = v_bill.id
  where id = any(v_order_ids);

  return v_bill;
end $$;
revoke execute on function create_bill(uuid, text) from public, anon;
grant execute on function create_bill(uuid, text) to authenticated, service_role;

-- ── 3.6 Scan analytics ──────────────────────────────────────────────────────

create table if not exists scan_events (
  id bigint generated always as identity primary key,
  business_id uuid not null references businesses(id) on delete cascade,
  table_no text,
  created_at timestamptz default now()
);
create index if not exists scan_events_business_created_idx on scan_events(business_id, created_at);
alter table scan_events enable row level security;
drop policy if exists "public insert scan" on scan_events;
create policy "public insert scan" on scan_events for insert
  with check (business_id in (select id from businesses where status = 'approved' and is_active = true));
drop policy if exists "owner read own scans" on scan_events;
create policy "owner read own scans" on scan_events
  for select using (
    business_id in (select id from businesses where owner_id = auth.uid())
    and exists (select 1 from business_features f
                where f.business_id = scan_events.business_id and f.analytics_enabled = true)
  );
drop policy if exists "admin read all scans" on scan_events;
create policy "admin read all scans" on scan_events for select using (is_admin());

-- ── 3.7 Admin audit log ─────────────────────────────────────────────────────

create table if not exists audit_log (
  id bigint generated always as identity primary key,
  admin_user_id uuid not null,
  action text not null,
  target_type text not null,
  target_id text not null,
  detail jsonb,
  created_at timestamptz default now()
);
alter table audit_log enable row level security;  -- no policies: service-role only

-- ── 3.8 Admin read policies (for admin JWTs; service role bypasses anyway) ──

drop policy if exists "admin read all businesses" on businesses;
create policy "admin read all businesses" on businesses for select using (is_admin());
drop policy if exists "admin read all testimonials" on testimonials;
create policy "admin read all testimonials" on testimonials for select using (is_admin());

-- ── 3.9 CMS pages (privacy, terms, anything) — admin-authored, publicly read ─
-- Markdown content, editable only in the Admin app (service role). The public
-- menu app and the future mobile app read published pages via the anon key.
create table if not exists pages (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]+$'),
  title text not null check (char_length(title) <= 120),
  content text not null default '',
  is_published boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table pages enable row level security;
-- Anyone (anon) can read a PUBLISHED page; drafts stay admin-only.
drop policy if exists "public read published pages" on pages;
create policy "public read published pages" on pages
  for select using (is_published = true);
drop policy if exists "admin read all pages" on pages;
create policy "admin read all pages" on pages for select using (is_admin());
-- Writes: service role only (no anon/owner write policy).

-- ============================================================================
-- MANUAL STEPS after running this file:
--
-- 1. Make yourself admin (replace the email):
--      insert into admin_users (user_id)
--      select id from auth.users where email = 'YOUR_EMAIL_HERE'
--      on conflict do nothing;
--    Then promote yourself to super admin (manages the Admin team/roles):
--      update admin_users set role = 'superadmin'
--      where user_id = (select id from auth.users where email = 'YOUR_EMAIL_HERE');
--
-- 2. Supabase Dashboard → Database → Replication → confirm the
--    supabase_realtime publication includes the "orders" table (the DO block
--    above adds it, but verify — realtime silently no-ops if missing).
-- ============================================================================
