// Admin-site RBAC. A user holds MULTIPLE roles (admin_users.roles text[]).
// superadmin implies every role. Add a `canX` helper here whenever a feature
// needs gating, then use it in the UI/action.

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
export type Roles = Role[] | null;

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

export const hasRole = (roles: Roles, r: Role): boolean => !!roles?.includes(r);

// ── Base ─────────────────────────────────────────────────────────────────────
export const isSuperAdmin = (roles: Roles): boolean => hasRole(roles, "superadmin");
/** superadmin implies admin; both pass every capability check. */
export const isAdmin = (roles: Roles): boolean =>
  isSuperAdmin(roles) || hasRole(roles, "admin");

// ── Sales (manager ⊇ member) ────────────────────────────────────────────────
export const canSalesManager = (roles: Roles): boolean =>
  isAdmin(roles) || hasRole(roles, "snap_sales_manager");
export const canSalesMember = (roles: Roles): boolean =>
  canSalesManager(roles) || hasRole(roles, "snap_sales_member");

// ── Analytics ────────────────────────────────────────────────────────────────
export const canAnalyticsRevenue = (roles: Roles): boolean =>
  isAdmin(roles) || hasRole(roles, "analytics_revenue");
export const canAnalyticsUsers = (roles: Roles): boolean =>
  isAdmin(roles) || hasRole(roles, "analytics_users");

// ── Manager / employee ───────────────────────────────────────────────────────
export const canManager = (roles: Roles): boolean =>
  isAdmin(roles) || hasRole(roles, "snap_manager");
export const canEmployee = (roles: Roles): boolean =>
  canManager(roles) || canSalesMember(roles) || hasRole(roles, "snap_employee");

// ── Team management ──────────────────────────────────────────────────────────
/** admin + superadmin can ASSIGN (add) roles. */
export const canAssignRoles = isAdmin;
/** Only superadmin can REMOVE roles or members, or grant superadmin. */
export const canRemoveRoles = isSuperAdmin;
