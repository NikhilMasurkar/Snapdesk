import { getOwnerBusiness } from "@/lib/dal";
import SettingsForm from "./SettingsForm";

const MENU_BASE_URL =
  process.env.NEXT_PUBLIC_MENU_BASE_URL ?? "https://snapdesk-tan.vercel.app";

export default async function SettingsPage() {
  const business = await getOwnerBusiness();
  if (!business) return null; // layout already handles this case

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Your business profile and ordering details.
        </p>
      </div>
      <SettingsForm
        business={business}
        liveMenuUrl={`${MENU_BASE_URL}/m/${business.slug}`}
      />
    </div>
  );
}
