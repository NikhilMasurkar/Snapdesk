export type Business = {
  id: string;
  slug: string;
  name: string;
  type: 'restaurant' | 'parlour' | 'bakery' | 'other';
  whatsapp_number: string;
  logo_url: string | null;
  tagline: string | null;
  menu_label: string;
  currency: string;
  is_active: boolean;
};

export type Category = {
  id: string;
  business_id: string;
  name: string;
  sort_order: number;
};

export type MenuItem = {
  id: string;
  business_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  photo_url: string | null;
  is_veg: boolean | null;
  has_portions: boolean;
  price_full: number;
  price_half: number | null;
  is_available: boolean;
  sort_order: number;
};

export type Testimonial = {
  id: string;
  business_id: string;
  customer_name: string;
  rating: number;
  text: string;
  created_at: string;
};

export type MenuSection = {
  id: string;
  name: string;
  items: MenuItem[];
};

/** "₹280" for whole amounts, "₹280.50" otherwise. */
export function formatMoney(currency: string, amount: number): string {
  const n = Number(amount);
  return `${currency}${Number.isInteger(n) ? n : n.toFixed(2)}`;
}
