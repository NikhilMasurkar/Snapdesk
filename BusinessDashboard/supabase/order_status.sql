-- ============================================================
-- Customer order-status lookup (menu page "order tracking")
-- anon has NO select policy on orders, so the public menu can't
-- read status directly. Same pattern as place_order: a SECURITY
-- DEFINER function exposing ONLY status + reason for one order.
-- Run on dev + prod. Safe to re-run.
-- ============================================================

create or replace function get_order_status(
  p_business_id uuid,
  p_short_id text
) returns table (status text, status_reason text)
language sql
security definer
set search_path = public
stable
as $$
  select o.status, o.status_reason
  from orders o
  where o.business_id = p_business_id
    and o.short_id = p_short_id
  order by o.created_at desc
  limit 1;
$$;

grant execute on function get_order_status(uuid, text) to anon, authenticated;
