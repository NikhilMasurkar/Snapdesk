-- Phase 1 schema — run this in the Supabase SQL editor first.

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
