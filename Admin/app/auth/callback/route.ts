import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Google redirects here with a `code`; swap it for a session cookie.
// Whether the account is actually an admin is decided by getAdmin() on "/".
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Behind Vercel the real host is in x-forwarded-host, not request.url.
      const forwardedHost = request.headers.get("x-forwarded-host");
      const base =
        process.env.NODE_ENV === "development" || !forwardedHost
          ? origin
          : `https://${forwardedHost}`;
      return NextResponse.redirect(base);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
