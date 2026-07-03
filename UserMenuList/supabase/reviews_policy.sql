-- Allow customers (anon key) to SUBMIT reviews from the public menu page.
-- They can only ever insert rows with status = 'pending' — approving is
-- still owner-only (see BusinessDashboard/supabase/phase2_auth.sql).
-- Run this in the Supabase SQL editor.

create policy "public submit pending testimonials" on testimonials
  for insert with check (status = 'pending');
