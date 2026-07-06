import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS entirely. NEVER import from client code
 * ("server-only" makes that a build error). Every caller must verify the
 * session is an allow-listed admin first (lib/admin.ts); that check is the
 * security boundary for this app.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
