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
};
