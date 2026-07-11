-- ============================================================
-- LEADS — Admin-site sales CRM (Sales → Leads)
-- Run after phase3.sql / phase4.sql. Safe to re-run.
--
-- Security: RLS enabled with NO policies on both tables — they are
-- unreachable via anon/authenticated keys (same model as admin_users).
-- All access goes through the Admin app's service-role server actions.
-- ============================================================

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  -- leads we add by hand are 'internal'; future types: signup, external
  lead_type text not null default 'internal',
  business_name text not null,
  contact_name text,
  phone text not null,
  address text,
  google_maps_url text,
  source text,
  temperature text check (temperature in ('hot','warm','cold','not_answering')),
  status text not null default 'open' check (status in ('open','converted','dead')),
  status_reason text,
  assigned_to uuid references auth.users(id) on delete set null,
  callback_at timestamptz,
  converted_business_id uuid references businesses(id) on delete set null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_assigned_status_idx on leads (assigned_to, status);
create index if not exists leads_callback_idx on leads (callback_at) where status = 'open';

alter table leads enable row level security;

create table if not exists lead_remarks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists lead_remarks_lead_idx on lead_remarks (lead_id, created_at desc);

alter table lead_remarks enable row level security;

-- keep updated_at fresh
create or replace function touch_leads_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end $$ language plpgsql;

drop trigger if exists trg_leads_touch on leads;
create trigger trg_leads_touch before update on leads
  for each row execute function touch_leads_updated_at();
