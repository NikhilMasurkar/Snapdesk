import { LogOut, Store } from "lucide-react";
import { getOwnerBusiness, requireUser } from "@/lib/dal";
import { logout } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import DashboardNav from "@/components/dashboard/DashboardNav";

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
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
          <Store className="size-6 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-bold">No business linked yet</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Your account (<strong>{user.email}</strong>) isn&apos;t linked to a
          business. Ask Snapdesk to run:
        </p>
        <pre className="max-w-full overflow-x-auto rounded-lg bg-muted p-3 text-left text-xs">
          {`update businesses set owner_id = '${user.id}'\nwhere slug = 'your-business-slug';`}
        </pre>
        <form action={logout}>
          <Button variant="outline" size="sm">
            <LogOut /> Log out
          </Button>
        </form>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col gap-3 border-b bg-sidebar p-4 md:w-60 md:border-b-0 md:border-r">
        <div className="flex items-center gap-3 px-1">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            {business.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{business.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <Separator />
        <DashboardNav liveMenuUrl={`${MENU_BASE_URL}/m/${business.slug}`} />
        <div className="md:mt-auto">
          <form action={logout}>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground"
            >
              <LogOut /> Log out
            </Button>
          </form>
        </div>
      </aside>
      <main className="flex-1 bg-muted/30 p-4 md:p-8">{children}</main>
    </div>
  );
}
