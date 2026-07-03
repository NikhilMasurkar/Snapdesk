-- Auto-delete rejected reviews 30 days after rejection.
-- Run this whole file in the Supabase SQL editor.

-- 1. Track WHEN a review was rejected (created_at is submission time,
--    which is the wrong clock to start the 30 days from).
alter table testimonials add column if not exists rejected_at timestamptz;

-- Keep rejected_at in sync automatically, no matter which app updates status.
create or replace function set_testimonial_rejected_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'rejected' then
    -- Only set rejected_at if it's a new insert, the status changed to rejected, or rejected_at was null.
    -- This prevents resetting the 30-day clock if other columns are updated.
    if tg_op = 'INSERT' or old.status is distinct from 'rejected' or old.rejected_at is null then
      new.rejected_at := now();
    end if;
  else
    new.rejected_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_testimonial_rejected_at on testimonials;
create trigger trg_testimonial_rejected_at
  before insert or update on testimonials
  for each row execute function set_testimonial_rejected_at();

-- Backfill any already-rejected rows so their 30-day clock starts today.
update testimonials set rejected_at = now()
  where status = 'rejected' and rejected_at is null;

-- 2. Daily purge at 03:00 UTC via pg_cron (runs as postgres, bypasses RLS).
create extension if not exists pg_cron;

-- Unschedule the job if it already exists to avoid duplicates/errors when running this script again.
select cron.unschedule(jobid)
from cron.job
where jobname = 'purge-rejected-testimonials';

select cron.schedule(
  'purge-rejected-testimonials',
  '0 3 * * *',
  $$ delete from testimonials
     where status = 'rejected'
       and rejected_at < now() - interval '30 days' $$
);
