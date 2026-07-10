"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Google-only sign-in (see login/page.tsx); this file keeps just logout.
export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
