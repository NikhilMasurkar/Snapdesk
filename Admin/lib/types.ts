export type Business = {
  id: string;
  slug: string;
  name: string;
  type: string;
  whatsapp_number: string;
  tagline: string | null;
  logo_url: string | null;
  is_active: boolean;
  status: "pending" | "approved" | "suspended" | "rejected";
  plan: "free" | "basic" | "premium";
  table_count: number;
  accepting_orders: boolean;
  is_demo: boolean;
  admin_notes: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  address: string | null;
  city: string | null;
  pincode: string | null;
  gst_number: string | null;
  opening_hours: string | null;
  owner_id: string | null;
  approved_at: string | null;
  created_at: string;
  /** Joined in app/page.tsx from auth.users via the service client. */
  owner_email?: string;
  /** §0.6 set in app/page.tsx when this application's phone matches another
   *  business — value is the matching business's name. */
  dup_warning?: string;
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
};

export type Bill = {
  id: string;
  bill_no: number;
  business_id: string;
  table_no: string | null;
  items: OrderItemLine[];
  subtotal: number;
  total: number;
  is_void: boolean;
  void_reason: string | null;
  created_at: string;
};

export type Testimonial = {
  id: string;
  business_id: string;
  customer_name: string;
  rating: number;
  text: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

export type Page = {
  id: string;
  slug: string;
  title: string;
  content: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type AuditRow = {
  id: number;
  admin_user_id: string;
  action: string;
  target_type: string;
  target_id: string;
  detail: Record<string, unknown> | null;
  created_at: string;
};
