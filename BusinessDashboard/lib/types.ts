export type Business = {
  id: string;
  slug: string;
  name: string;
  type: "restaurant" | "parlour" | "bakery" | "other";
  whatsapp_number: string;
  logo_url: string | null;
  tagline: string | null;
  menu_label: string;
  currency: string;
  is_active: boolean;
  status: "pending" | "approved" | "suspended" | "rejected";
  plan: "free" | "basic" | "premium";
  table_count: number;
  accepting_orders: boolean;
  owner_name: string | null;
  owner_phone: string | null;
  address: string | null;
  city: string | null;
  pincode: string | null;
  gst_number: string | null;
  opening_hours: string | null;
  owner_id: string | null;
  timezone: string;
};

export type BusinessFeatures = {
  business_id: string;
  ordering_enabled: boolean;
  testimonials_enabled: boolean;
  photos_enabled: boolean;
  analytics_enabled: boolean;
  tables_enabled: boolean;
  qr_download_enabled: boolean;
  max_menu_items: number;
};

export type OrderItemLine = {
  item_id?: string;
  name: string;
  portion: string | null;
  qty: number;
  unit_price: number;
  line_total: number;
};

export type Order = {
  id: string;
  short_id: string;
  business_id: string;
  table_no: string | null;
  items: OrderItemLine[];
  total: number;
  note: string | null;
  status: "pending" | "approved" | "rejected" | "billed" | "cancelled";
  status_reason: string | null;
  source: "customer" | "staff";
  bill_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Bill = {
  id: string;
  bill_no: number;
  business_id: string;
  table_no: string | null;
  items: OrderItemLine[];
  subtotal: number;
  total: number;
  order_ids: string[];
  is_void: boolean;
  void_reason: string | null;
  created_at: string;
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
  status: "pending" | "approved" | "rejected";
  created_at: string;
  rejected_at?: string | null;
};
