import { Store, LogOut } from "lucide-react";
import { getOwnerBusiness, requireUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import Sidebar from "@/components/dashboard/Sidebar";

const MENU_BASE_URL =
  process.env.NEXT_PUBLIC_MENU_BASE_URL ?? "https://snapdesk-tan.vercel.app";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const business = await getOwnerBusiness();

  if (!business) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 py-16 text-center bg-muted/20">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Store className="size-6" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">No business linked yet</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Your account (<strong>{user.email}</strong>) isn&apos;t linked to a
          business. Ask Snapdesk to run:
        </p>
        <pre className="max-w-full overflow-x-auto rounded-lg bg-muted border p-3.5 text-left text-xs font-mono text-foreground/90">
          {`update businesses set owner_id = '${user.id}'\nwhere slug = 'your-business-slug';`}
        </pre>
        <form action={logout}>
          <Button variant="outline" size="sm">
            <LogOut className="mr-2 size-4" /> Log out
          </Button>
        </form>
      </main>
    );
  }

  // Fetch pending testimonials count for navigation badge
  const supabase = await createClient();
  const { count } = await supabase
    .from("testimonials")
    .select("*", { count: "exact", head: true })
    .eq("business_id", business.id)
    .eq("status", "pending");

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-background">
      <Sidebar
        business={business}
        user={user}
        pendingTestimonialsCount={count ?? 0}
        liveMenuUrl={`${MENU_BASE_URL}/m/${business.slug}`}
      />
      <main className="flex-1 bg-muted/20 min-h-[calc(100vh-4rem)] md:min-h-screen p-4 sm:p-6 md:p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
