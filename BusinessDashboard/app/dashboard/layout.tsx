import Link from "next/link";
import { getOwnerBusiness, requireUser } from "@/lib/dal";
import { logout } from "@/app/login/actions";

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
        <h1 className="text-xl font-bold">No business linked yet</h1>
        <p className="max-w-sm text-sm text-zinc-600">
          Your account (<strong>{user.email}</strong>) isn&apos;t linked to a
          business. Ask Snapdesk to run:
        </p>
        <pre className="max-w-full overflow-x-auto rounded-lg bg-zinc-100 p-3 text-left text-xs">
          {`update businesses set owner_id = '${user.id}'\nwhere slug = 'your-business-slug';`}
        </pre>
        <form action={logout}>
          <button className="text-sm font-medium text-zinc-500 underline">
            Log out
          </button>
        </form>
      </main>
    );
  }

  const navItems = [
    { href: "/dashboard/menu", label: "Menu" },
    { href: "/dashboard/settings", label: "Settings" },
    { href: "/dashboard/testimonials", label: "Testimonials" },
  ];

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col gap-1 border-b border-zinc-200 bg-zinc-50 p-4 md:w-56 md:border-b-0 md:border-r">
        <div className="mb-3 px-2">
          <p className="truncate text-sm font-bold">{business.name}</p>
          <p className="truncate text-xs text-zinc-500">{user.email}</p>
        </div>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200"
          >
            {item.label}
          </Link>
        ))}
        <a
          href={`https://snapdesk-tan.vercel.app/m/${business.slug}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200"
        >
          View live menu ↗
        </a>
        <form action={logout} className="mt-2">
          <button className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50">
            Log out
          </button>
        </form>
      </aside>
      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
