-- ============================================================================
-- Snapdesk — PHASE 4 §0: gap fixes found auditing Phases 1–3.
-- Run AFTER phase3.sql, on dev first, then prod. Idempotent.
-- ============================================================================

-- ── 0.1 Cancelled orders (clear a table without billing) ────────────────────
-- An approved order whose customer walked out can now be cancelled with a
-- reason. Cancelled orders never appear in revenue (revenue = bills only).
alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check
  check (status in ('pending','approved','rejected','billed','cancelled'));

-- ── 0.2 Rejection/cancellation reasons ───────────────────────────────────────
alter table orders add column if not exists status_reason text
  check (status_reason is null or char_length(status_reason) <= 200);

-- Frozen-state rules now cover cancelled too.
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
  if old.status in ('rejected','cancelled') and new.status is distinct from old.status then
    raise exception 'Closed orders cannot be reopened';
  end if;
  new.updated_at := now();
  return new;
end $$;

-- ── 0.3 Per-business timezone (daily figures reset at local midnight) ───────
alter table businesses add column if not exists timezone text not null default 'Asia/Kolkata';

-- ── 0.4 Scan flood control (no external rate-limit infra needed) ────────────
-- ponytail: DB trigger instead of Upstash — zero new accounts/deps. Caps anon
-- scan inserts at 30/min per business; upgrade to edge rate limiting if a real
-- attack ever outruns the DB.
create or replace function enforce_scan_cap()
returns trigger language plpgsql security definer as $$
declare cnt int;
begin
  select count(*) into cnt from scan_events
  where business_id = new.business_id
    and created_at > now() - interval '1 minute';
  if cnt >= 30 then
    raise exception 'Too many scans, slow down';
  end if;
  return new;
end $$;
drop trigger if exists trg_scan_cap on scan_events;
create trigger trg_scan_cap before insert on scan_events
  for each row execute function enforce_scan_cap();

-- ── 0.5 Maintain updated_at (menus never recorded when they were touched) ───
alter table businesses  add column if not exists updated_at timestamptz default now();
alter table categories  add column if not exists updated_at timestamptz default now();
alter table menu_items  add column if not exists updated_at timestamptz default now();

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_touch_businesses on businesses;
create trigger trg_touch_businesses before update on businesses
  for each row execute function set_updated_at();
drop trigger if exists trg_touch_categories on categories;
create trigger trg_touch_categories before update on categories
  for each row execute function set_updated_at();
drop trigger if exists trg_touch_menu_items on menu_items;
create trigger trg_touch_menu_items before update on menu_items
  for each row execute function set_updated_at();

-- ── 0.7 table_hint on reviews (which table the reviewer sat at) ─────────────
alter table testimonials add column if not exists table_hint text
  check (table_hint is null or char_length(table_hint) <= 20);
