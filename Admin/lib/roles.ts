// Admin-site RBAC. One role per admin user (stored on admin_users.role).
// superadmin + admin are god-mode — they pass every capability check below.
// Add a new `canX` helper here whenever a feature needs to be shown to a
// specific set of roles, then gate the UI/action with it.

export const ROLES = [
  "superadmin",
  "admin",
  "snap_manager",
  "snap_sales_manager",
  "snap_sales_member",
  "snap_employee",
  "analytics_revenue",
  "analytics_users",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  snap_manager: "Manager",
  snap_sales_manager: "Sales Manager",
  snap_sales_member: "Sales Member",
  snap_employee: "Employee",
  analytics_revenue: "Analytics — Revenue",
  analytics_users: "Analytics — Users",
};

// ── Base ─────────────────────────────────────────────────────────────────────
export const isSuperAdmin = (r: Role | null): boolean => r === "superadmin";
/** God-mode: superadmin or admin pass everything. */
export const isAdmin = (r: Role | null): boolean =>
  r === "superadmin" || r === "admin";

// ── Sales (manager ⊇ member) ────────────────────────────────────────────────
export const canSalesManager = (r: Role | null): boolean =>
  isAdmin(r) || r === "snap_sales_manager";
export const canSalesMember = (r: Role | null): boolean =>
  canSalesManager(r) || r === "snap_sales_member";

// ── Analytics ────────────────────────────────────────────────────────────────
export const canAnalyticsRevenue = (r: Role | null): boolean =>
  isAdmin(r) || r === "analytics_revenue";
export const canAnalyticsUsers = (r: Role | null): boolean =>
  isAdmin(r) || r === "analytics_users";

// ── Manager / employee ───────────────────────────────────────────────────────
export const canManager = (r: Role | null): boolean =>
  isAdmin(r) || r === "snap_manager";
export const canEmployee = (r: Role | null): boolean =>
  canManager(r) || canSalesMember(r) || r === "snap_employee";

// ── Team/role management: super admin only ──────────────────────────────────
export const canManageTeam = isSuperAdmin;
