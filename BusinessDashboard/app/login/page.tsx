import { Store } from "lucide-react";
import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const { created } = await searchParams;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 bg-muted/40 px-4 py-16">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Store className="size-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Snapdesk Business</h1>
        <p className="text-sm text-muted-foreground">
          Manage your menu, availability, and WhatsApp orders.
        </p>
      </div>
      <LoginForm justCreated={created === "1"} />
    </main>
  );
}
