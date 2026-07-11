import { Ban, Clock, LogOut, Mail, PauseCircle } from "lucide-react";
import { getOwnerBusiness, getOwnerFeatures, requireUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import Sidebar from "@/components/dashboard/Sidebar";
import RegisterBusinessForm from "@/app/dashboard/onboarding/RegisterBusinessForm";
import { SUPPORT_EMAIL } from "@/lib/config";

/** PHASE3_SPEC §5.2: exactly two actions — contact support and log out. */
function LockScreen({
  icon,
  title,
  children,
  email,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  email: string | undefined;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 py-16 text-center bg-muted/20">
      {icon}
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{children}</p>
      <div className="flex gap-2">
        <Button variant="default" size="sm" asChild>
          <a href={`mailto:${SUPPORT_EMAIL}`}>
            <Mail className="mr-2 size-4" /> Contact support
          </a>
        </Button>
        <form action={logout}>
          <Button variant="outline" size="sm">
            <LogOut className="mr-2 size-4" /> Log out
          </Button>
        </form>
      </div>
      {email && <p className="text-xs text-muted-foreground/80">Signed in as {email}</p>}
    </main>
  );
}

const MENU_BASE_URL =
  process.env.NEXT_PUBLIC_MENU_BASE_URL ?? "https://snapdesk-tan.vercel.app";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const business = await getOwnerBusiness();

  // Self-service onboarding: no business yet → register one (lands as pending).
  if (!business) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 py-16 bg-muted/20">
        <RegisterBusinessForm email={user.email ?? ""} />
        <form action={logout}>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <LogOut className="mr-2 size-4" /> Log out
          </Button>
        </form>
      </main>
    );
  }

  // PHASE3_SPEC §5.2: server-side status gate. Only 'approved' gets the
  // dashboard; everyone else gets the matching lock screen. The public menu
  // is gated the same way at the database (RLS requires status='approved').
  if (business.status === "pending") {
    const steps: { label: string; detail: string; state: "done" | "now" | "next" }[] = [
      {
        label: "Application submitted",
        detail: `${business.name} is registered with Snapdesk.`,
        state: "done",
      },
      {
        label: "Under review",
        detail: "Our team verifies your details — usually within 24 hours.",
        state: "now",
      },
      {
        label: "Approval & setup",
        detail: "You get full dashboard access: add your menu, tables, and QR codes.",
        state: "next",
      },
      {
        label: "Go live",
        detail: "Print your table QRs and start taking orders.",
        state: "next",
      },
    ];
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16 bg-muted/20">
        <div className="flex size-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
          <Clock className="size-6" />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold tracking-tight">Application under review</h1>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            <strong>{business.name}</strong> has been submitted. Here&apos;s what
            happens next:
          </p>
        </div>

        <ol className="w-full max-w-sm space-y-0">
          {steps.map((s, i) => (
            <li key={s.label} className="relative flex gap-3 pb-5 last:pb-0">
              {i < steps.length - 1 && (
                <span className="absolute left-[11px] top-6 h-full w-px bg-border" aria-hidden />
              )}
              <span
                className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  s.state === "done"
                    ? "bg-emerald-500 text-white"
                    : s.state === "now"
                      ? "bg-amber-500 text-white animate-pulse"
                      : "border bg-background text-muted-foreground"
                }`}
              >
                {s.state === "done" ? "✓" : i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold">{s.label}</p>
                <p className="text-xs text-muted-foreground">{s.detail}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="flex gap-2">
          <Button variant="default" size="sm" asChild>
            <a href={`mailto:${SUPPORT_EMAIL}`}>
              <Mail className="mr-2 size-4" /> Contact support
            </a>
          </Button>
          <form action={logout}>
            <Button variant="outline" size="sm">
              <LogOut className="mr-2 size-4" /> Log out
            </Button>
          </form>
        </div>
        {user.email && (
          <p className="text-xs text-muted-foreground/80">Signed in as {user.email}</p>
        )}
      </main>
    );
  }

  if (business.status === "rejected") {
    return (
      <LockScreen
        email={user.email}
        title="Application not approved"
        icon={
          <div className="flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <Ban className="size-6" />
          </div>
        }
      >
        Your application for <strong>{business.name}</strong> was not approved.
        If you think this is a mistake, contact support.
      </LockScreen>
    );
  }

  if (business.status === "suspended") {
    return (
      <LockScreen
        email={user.email}
        title="Account suspended"
        icon={
          <div className="flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <PauseCircle className="size-6" />
          </div>
        }
      >
        <strong>{business.name}</strong> is suspended and your public menu page
        is offline. Contact support to restore access.
      </LockScreen>
    );
  }

  const supabase = await createClient();
  const features = await getOwnerFeatures(business.id);
  const [{ count: testimonialCount }, { count: orderCount }] = await Promise.all([
    supabase
      .from("testimonials")
      .select("*", { count: "exact", head: true })
      .eq("business_id", business.id)
      .eq("status", "pending"),
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("business_id", business.id)
      .eq("status", "pending"),
  ]);

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-background">
      <Sidebar
        business={business}
        user={user}
        features={features}
        pendingTestimonialsCount={testimonialCount ?? 0}
        pendingOrdersCount={orderCount ?? 0}
        liveMenuUrl={`${MENU_BASE_URL}/m/${business.slug}`}
      />
      <main className="flex-1 bg-muted/20 min-h-[calc(100vh-4rem)] md:min-h-screen p-4 sm:p-6 md:p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
