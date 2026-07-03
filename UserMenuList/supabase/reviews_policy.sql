-- Customer reviews: submission policy + rating stats view.
-- Run this whole file in the Supabase SQL editor.

-- 1. Allow customers (anon key) to SUBMIT reviews from the public menu page.
--    They can only ever insert rows with status = 'pending' — approving is
--    still owner-only (see BusinessDashboard/supabase/phase2_auth.sql).
drop policy if exists "public submit pending testimonials" on testimonials;
create policy "public submit pending testimonials" on testimonials
  for insert with check (status = 'pending');

-- 2. True review count + average per business, aggregated in the database.
--    The menu page shows only the latest few review cards, but the summary
--    line ("4.6 · 128 reviews") must reflect ALL approved reviews.
--    Exposes only aggregates of approved rows — no pending/rejected data.
create or replace view business_review_stats as
  select
    business_id,
    count(*)::int as review_count,
    round(avg(rating)::numeric, 2) as avg_rating
  from testimonials
  where status = 'approved'
  group by business_id;
