import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Properties from "@/lib/properties";

// Google redirects here with a `code`; swap it for a session cookie.
// Whether the account is actually an admin is decided by getAdmin() on "/".
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(Properties.BASE_URL);
  }

  return NextResponse.redirect(`${Properties.BASE_URL}/login?error=oauth`);
}
