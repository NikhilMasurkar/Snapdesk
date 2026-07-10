"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "../_components/ThemeToggle";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    setLoading(true);
    setError(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    // On success the browser navigates to Google; only reset on failure.
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 transition-colors duration-200">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-primary/10 blur-3xl -z-10 pointer-events-none" />

      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl transition-all duration-200 hover:shadow-2xl hover:border-muted/50">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="flex items-center justify-center size-12 rounded-xl bg-primary/10 text-primary mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-6">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25"
              />
            </svg>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-card-foreground">
            Snapdesk <span className="bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">Admin</span>
          </h1>
          <p className="mt-2 text-sm text-muted">
            Restricted area — Authorized administrator accounts only
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-danger-bg border border-danger/20 px-4 py-3 text-sm text-danger">
            <p className="font-medium">{error}</p>
          </div>
        )}

        <button
          onClick={signIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-border bg-background hover:bg-muted-bg px-4 py-3 text-sm font-bold text-foreground shadow-sm transition-all cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <svg className="animate-spin size-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
              <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
            </svg>
          )}
          Continue with Google
        </button>

        <p className="mt-4 text-center text-[11px] text-muted">
          Access is granted by a super admin. Signing in without a role shows
          an access-denied screen.
        </p>
      </div>
    </main>
  );
}
