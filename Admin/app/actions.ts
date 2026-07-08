"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { writeAudit } from "@/lib/audit";
import { createServiceClient } from "@/lib/service";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * PHASE3_SPEC §4.2 adminAction wrapper: admin check first, mutation via
 * service client, then a mandatory audit row. The service role bypasses RLS,
 * so the requireAdmin() call here IS the security boundary.
 */
async function adminAction(
  action: string,
  targetId: string,
  detail: Record<string, unknown>,
  mutate: (service: ReturnType<typeof createServiceClient>) => Promise<string | null>,
  opts: { targetType?: string; revalidate?: string[] } = {}
): Promise<ActionResult> {
  let adminId: string;
  try {
    adminId = (await requireAdmin()).id;
  } catch {
    return { ok: false, error: "Not authorized." };
  }

  const service = createServiceClient();
  const error = await mutate(service);
  if (error) return { ok: false, error };

  await writeAudit(adminId, action, opts.targetType ?? "business", targetId, detail);
  revalidatePath("/");
  for (const p of opts.revalidate ?? []) revalidatePath(p);
  return { ok: true };
}

const PLANS = ["free", "basic", "premium"] as const;
export type Plan = (typeof PLANS)[number];

// Plan presets (spec 4.3): what each plan unlocks.
const PLAN_FEATURES: Record<Plan, Record<string, boolean | number>> = {
  free: { photos_enabled: false, analytics_enabled: false, max_menu_items: 30 },
  basic: { photos_enabled: true, analytics_enabled: false, max_menu_items: 100 },
  premium: { photos_enabled: true, analytics_enabled: true, max_menu_items: 500 },
};

export async function approveBusiness(
  id: string,
  plan: Plan,
  tableCount: number
): Promise<ActionResult> {
  if (!PLANS.includes(plan)) return { ok: false, error: "Invalid plan." };
  const tables = Math.floor(Number(tableCount));
  if (Number.isNaN(tables) || tables < 0 || tables > 200) {
    return { ok: false, error: "Table count must be between 0 and 200." };
  }

  return adminAction("approve_business", id, { plan, table_count: tables }, async (service) => {
    const { error } = await service
      .from("businesses")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        plan,
        table_count: tables,
      })
      .eq("id", id);
    if (error) return error.message;

    const { error: fErr } = await service
      .from("business_features")
      .update(PLAN_FEATURES[plan])
      .eq("business_id", id);
    return fErr?.message ?? null;
  });
}

export async function rejectBusiness(id: string, reason: string): Promise<ActionResult> {
  if (!reason.trim()) return { ok: false, error: "A rejection reason is required." };
  return adminAction("reject_business", id, { reason }, async (service) => {
    const { error } = await service
      .from("businesses")
      .update({ status: "rejected", admin_notes: reason.trim() })
      .eq("id", id);
    return error?.message ?? null;
  });
}

export async function suspendBusiness(id: string, reason: string): Promise<ActionResult> {
  if (!reason.trim()) return { ok: false, error: "A suspension reason is required." };
  return adminAction("suspend_business", id, { reason }, async (service) => {
    const { error } = await service
      .from("businesses")
      .update({ status: "suspended", admin_notes: reason.trim() })
      .eq("id", id);
    return error?.message ?? null;
  });
}

export async function reactivateBusiness(id: string): Promise<ActionResult> {
  return adminAction("reactivate_business", id, {}, async (service) => {
    const { error } = await service
      .from("businesses")
      .update({ status: "approved" })
      .eq("id", id);
    return error?.message ?? null;
  });
}

/** Frees the owner account to re-apply (one-business-per-owner rule). */
export async function deleteRejectedBusiness(id: string): Promise<ActionResult> {
  return adminAction("delete_business", id, {}, async (service) => {
    const { error } = await service
      .from("businesses")
      .delete()
      .eq("id", id)
      .eq("status", "rejected"); // only rejected rows are deletable
    return error?.message ?? null;
  });
}

// ── Business detail control room (§4.3) ──────────────────────────────────────

export type BusinessInfoInput = {
  name: string;
  tagline: string;
  whatsapp_number: string;
  owner_name: string;
  owner_phone: string;
  address: string;
  city: string;
  pincode: string;
  gst_number: string;
  opening_hours: string;
  admin_notes: string;
};

/** Admin edits the application fields (fix typos, update phone) + admin notes. */
export async function updateBusinessInfo(
  id: string,
  input: BusinessInfoInput
): Promise<ActionResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Business name is required." };
  const whatsapp = input.whatsapp_number.replace(/\D/g, "");
  if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 15)) {
    return { ok: false, error: "WhatsApp number must be 10–15 digits." };
  }

  return adminAction(
    "update_business",
    id,
    { fields: Object.keys(input) },
    async (service) => {
      const { error } = await service
        .from("businesses")
        .update({
          name,
          tagline: input.tagline.trim() || null,
          whatsapp_number: whatsapp || null,
          owner_name: input.owner_name.trim() || null,
          owner_phone: input.owner_phone.trim() || null,
          address: input.address.trim() || null,
          city: input.city.trim() || null,
          pincode: input.pincode.trim() || null,
          gst_number: input.gst_number.trim() || null,
          opening_hours: input.opening_hours.trim() || null,
          admin_notes: input.admin_notes.trim() || null,
        })
        .eq("id", id);
      return error?.message ?? null;
    },
    { revalidate: [`/business/${id}`] }
  );
}

/** Re-link a business to an owner account by email (they changed accounts). */
export async function linkOwnerByEmail(
  id: string,
  email: string
): Promise<ActionResult> {
  const clean = email.trim().toLowerCase();
  if (!clean) return { ok: false, error: "Enter the owner's email." };

  return adminAction(
    "link_owner",
    id,
    { email: clean },
    async (service) => {
      // Find the auth user by email (admin API — paginated).
      const { data, error } = await service.auth.admin.listUsers({ perPage: 1000 });
      if (error) return error.message;
      const user = data.users.find((u) => u.email?.toLowerCase() === clean);
      if (!user) return "No account found with that email. They must sign up first.";

      const { error: upErr } = await service
        .from("businesses")
        .update({ owner_id: user.id })
        .eq("id", id);
      return upErr?.message ?? null;
    },
    { revalidate: [`/business/${id}`] }
  );
}

export type FeaturesInput = {
  ordering_enabled: boolean;
  testimonials_enabled: boolean;
  photos_enabled: boolean;
  analytics_enabled: boolean;
  tables_enabled: boolean;
  qr_download_enabled: boolean;
  max_menu_items: number;
};

/** Toggle individual feature flags / item cap for a business. */
export async function updateFeatures(
  id: string,
  input: FeaturesInput
): Promise<ActionResult> {
  const cap = Math.floor(Number(input.max_menu_items));
  if (Number.isNaN(cap) || cap < 1 || cap > 5000) {
    return { ok: false, error: "Item cap must be between 1 and 5000." };
  }
  return adminAction(
    "update_features",
    id,
    { ...input, max_menu_items: cap },
    async (service) => {
      const { error } = await service
        .from("business_features")
        .update({
          ordering_enabled: input.ordering_enabled,
          testimonials_enabled: input.testimonials_enabled,
          photos_enabled: input.photos_enabled,
          analytics_enabled: input.analytics_enabled,
          tables_enabled: input.tables_enabled,
          qr_download_enabled: input.qr_download_enabled,
          max_menu_items: cap,
        })
        .eq("business_id", id);
      return error?.message ?? null;
    },
    { revalidate: [`/business/${id}`] }
  );
}

/** 10.7 Flag a business as a demo (excluded from platform revenue/stats). */
export async function setDemo(id: string, isDemo: boolean): Promise<ActionResult> {
  return adminAction(
    "set_demo",
    id,
    { is_demo: isDemo },
    async (service) => {
      const { error } = await service
        .from("businesses")
        .update({ is_demo: isDemo })
        .eq("id", id);
      return error?.message ?? null;
    },
    { revalidate: [`/business/${id}`] }
  );
}

/**
 * The system's ONLY testimonial delete path (§4.3). Audited with the full
 * text so a legal/abuse removal is always traceable.
 */
export async function deleteTestimonial(
  testimonialId: string,
  businessId: string,
  text: string
): Promise<ActionResult> {
  return adminAction(
    "delete_testimonial",
    testimonialId,
    { business_id: businessId, text },
    async (service) => {
      const { error } = await service
        .from("testimonials")
        .delete()
        .eq("id", testimonialId);
      return error?.message ?? null;
    },
    { targetType: "testimonial", revalidate: [`/business/${businessId}`] }
  );
}

// ── CMS pages (privacy, terms, …) ────────────────────────────────────────────

const SLUG_RE = /^[a-z0-9-]+$/;

export type PageInput = {
  slug: string;
  title: string;
  content: string;
  is_published: boolean;
};

function validatePage(input: PageInput): string | null {
  if (!input.title.trim()) return "Title is required.";
  if (!SLUG_RE.test(input.slug)) return "Slug must be lowercase letters, numbers, and hyphens.";
  return null;
}

export async function createPage(
  input: PageInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const err = validatePage(input);
  if (err) return { ok: false, error: err };

  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Not authorized." };
  }
  const service = createServiceClient();
  const { data, error } = await service
    .from("pages")
    .insert({
      slug: input.slug.trim(),
      title: input.title.trim(),
      content: input.content,
      is_published: input.is_published,
    })
    .select("id")
    .single();

  if (error) {
    return {
      ok: false,
      error: error.code === "23505" ? "That slug is already taken." : error.message,
    };
  }
  const id = (data as { id: string }).id;
  const res = await adminAction(
    "create_page",
    id,
    { slug: input.slug, title: input.title },
    async () => null,
    { targetType: "page", revalidate: ["/pages"] }
  );
  return res.ok ? { ok: true, id } : res;
}

export async function updatePage(id: string, input: PageInput): Promise<ActionResult> {
  const err = validatePage(input);
  if (err) return { ok: false, error: err };
  return adminAction(
    "update_page",
    id,
    { slug: input.slug, is_published: input.is_published },
    async (service) => {
      const { error } = await service
        .from("pages")
        .update({
          slug: input.slug.trim(),
          title: input.title.trim(),
          content: input.content,
          is_published: input.is_published,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) {
        return error.code === "23505" ? "That slug is already taken." : error.message;
      }
      return null;
    },
    { targetType: "page", revalidate: ["/pages", `/pages/${id}`] }
  );
}

export async function deletePage(id: string): Promise<ActionResult> {
  return adminAction(
    "delete_page",
    id,
    {},
    async (service) => {
      const { error } = await service.from("pages").delete().eq("id", id);
      return error?.message ?? null;
    },
    { targetType: "page", revalidate: ["/pages"] }
  );
}
