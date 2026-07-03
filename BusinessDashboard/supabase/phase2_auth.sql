-- Phase 2 — owner auth & dashboard write access.
-- Run this against the SAME Supabase project already used by UserMenuList
-- (one shared backend, per product decision). Run AFTER schema.sql + seed.sql.

-- Each business belongs to exactly one owner (Supabase Auth user).
alter table businesses add column owner_id uuid references auth.users(id);

-- Public menu read policies (from Phase 1) are untouched. Add owner write access:

create policy "owner update own business" on businesses
  for update using (owner_id = auth.uid());

create policy "owner insert categories" on categories
  for insert with check (
    business_id in (select id from businesses where owner_id = auth.uid())
  );
create policy "owner update categories" on categories
  for update using (
    business_id in (select id from businesses where owner_id = auth.uid())
  );
create policy "owner delete categories" on categories
  for delete using (
    business_id in (select id from businesses where owner_id = auth.uid())
  );

create policy "owner insert items" on menu_items
  for insert with check (
    business_id in (select id from businesses where owner_id = auth.uid())
  );
create policy "owner update items" on menu_items
  for update using (
    business_id in (select id from businesses where owner_id = auth.uid())
  );
create policy "owner delete items" on menu_items
  for delete using (
    business_id in (select id from businesses where owner_id = auth.uid())
  );

-- Owners can see ALL their testimonials (not just approved) and moderate them.
create policy "owner read own testimonials" on testimonials
  for select using (
    business_id in (select id from businesses where owner_id = auth.uid())
  );
create policy "owner update testimonials" on testimonials
  for update using (
    business_id in (select id from businesses where owner_id = auth.uid())
  );

-- ── After an owner signs up in the dashboard (email/password), link them to
-- their business by running (replace values):
--
--   update businesses set owner_id = 'AUTH_USER_UUID' where slug = 'spice-garden';
--
-- Find AUTH_USER_UUID in Supabase Dashboard → Authentication → Users.
