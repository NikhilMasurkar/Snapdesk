import "server-only";
import { createServiceClient } from "@/lib/service";

/**
 * PHASE3_SPEC §4.2: every admin mutation writes exactly one audit row.
 * Called from adminAction() — never skip it when adding new actions.
 */
export async function writeAudit(
  adminUserId: string,
  action: string,
  targetType: string,
  targetId: string,
  detail?: Record<string, unknown>
) {
  const service = createServiceClient();
  const { error } = await service.from("audit_log").insert({
    admin_user_id: adminUserId,
    action,
    target_type: targetType,
    target_id: targetId,
    detail: detail ?? null,
  });
  // Audit failures should be loud in logs but not break the mutation result.
  if (error) console.error("audit_log write failed:", error.message);
}
