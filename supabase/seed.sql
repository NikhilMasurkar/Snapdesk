-- Phase 1 seed — run AFTER schema.sql. IDs are resolved automatically.
-- Seeds two businesses: a restaurant (spice-garden) and a parlour (glow-beauty)
-- so you can test independent carts (acceptance #7) and the no-table /
-- no-veg-dot case.

do $$
declare
  biz uuid;
  cat_starters uuid;
  cat_main uuid;
  cat_breads uuid;
  cat_bev uuid;
  biz2 uuid;
  cat_hair uuid;
  cat_skin uuid;
begin
  -- ── Spice Garden (restaurant) ──────────────────────────────
  insert into businesses (slug, name, type, whatsapp_number, tagline, menu_label)
  values ('spice-garden', 'Spice Garden', 'restaurant', '919812345678',
          'Authentic Indian Cuisine', 'Menu')
  returning id into biz;

  insert into categories (business_id, name, sort_order)
    values (biz, 'Starters', 1) returning id into cat_starters;
  insert into categories (business_id, name, sort_order)
    values (biz, 'Main Course', 2) returning id into cat_main;
  insert into categories (business_id, name, sort_order)
    values (biz, 'Breads', 3) returning id into cat_breads;
  insert into categories (business_id, name, sort_order)
    values (biz, 'Beverages', 4) returning id into cat_bev;

  insert into menu_items (business_id, category_id, name, description, is_veg, has_portions, price_half, price_full, is_available, sort_order) values
    (biz, cat_starters, 'Paneer Tikka', 'Char-grilled cottage cheese with mint chutney', true,  true, 140, 260, true, 1),
    (biz, cat_starters, 'Chicken 65', 'Spicy deep-fried chicken, curry leaves', false, true, 160, 300, true, 2),
    (biz, cat_main, 'Paneer Butter Masala', 'Rich tomato-butter gravy', true, true, 150, 280, true, 1),
    (biz, cat_main, 'Veg Biryani', 'Fragrant basmati with seasonal vegetables', true, true, 150, 280, true, 2),
    (biz, cat_main, 'Chicken Biryani', 'Hyderabadi style, served with raita', false, true, 180, 340, true, 3),
    (biz, cat_breads, 'Butter Naan', null, true, false, null, 40, true, 1),
    (biz, cat_breads, 'Tandoori Roti', null, true, false, null, 25, true, 2),
    (biz, cat_bev, 'Masala Chai', null, true, false, null, 30, true, 1),
    (biz, cat_bev, 'Fresh Lime Soda', null, true, false, null, 50, false, 2); -- sold out, for testing

  insert into testimonials (business_id, customer_name, rating, text, status) values
    (biz, 'Ravi Kumar', 5, 'Best biryani in the area. Ordering from the table QR was super easy!', 'approved'),
    (biz, 'Sneha P.', 4, 'Loved the paneer tikka. Quick service.', 'approved'),
    (biz, 'Spam Bot', 1, 'buy followers cheap', 'rejected');

  -- ── Glow Beauty (parlour: no veg dots, 'Services' label) ───
  insert into businesses (slug, name, type, whatsapp_number, tagline, menu_label)
  values ('glow-beauty', 'Glow Beauty Parlour', 'parlour', '919812345678',
          'Look your best, every day', 'Services')
  returning id into biz2;

  insert into categories (business_id, name, sort_order)
    values (biz2, 'Hair Care', 1) returning id into cat_hair;
  insert into categories (business_id, name, sort_order)
    values (biz2, 'Skin Care', 2) returning id into cat_skin;

  insert into menu_items (business_id, category_id, name, description, is_veg, has_portions, price_half, price_full, is_available, sort_order) values
    (biz2, cat_hair, 'Haircut & Styling', null, null, false, null, 350, true, 1),
    (biz2, cat_hair, 'Hair Spa', 'Deep conditioning treatment', null, false, null, 800, true, 2),
    (biz2, cat_skin, 'Classic Facial', null, null, false, null, 600, true, 1),
    (biz2, cat_skin, 'Clean-up', null, null, false, null, 400, true, 2);

  insert into testimonials (business_id, customer_name, rating, text, status) values
    (biz2, 'Anita D.', 5, 'Amazing hair spa, very professional staff.', 'approved');
end $$;
