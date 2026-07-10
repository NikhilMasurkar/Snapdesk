import { Store } from "lucide-react";
import GoogleButton from "./GoogleButton";

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 bg-muted/40 px-4 py-16">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Store className="size-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Snapdesk Business</h1>
        <p className="text-sm text-muted-foreground">
          Manage your menu, tables, and live orders.
        </p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        <GoogleButton />
        <p className="text-center text-xs text-muted-foreground">
          New here? Signing in creates your account — you&apos;ll fill in your
          business application next.
        </p>
      </div>
    </main>
  );
}
