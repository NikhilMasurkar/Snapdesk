import { getOwnerBusiness } from "@/lib/dal";
import SettingsForm from "./SettingsForm";

export default async function SettingsPage() {
  const business = await getOwnerBusiness();
  if (!business) return null; // layout already handles this case

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Your business profile and ordering details.
        </p>
      </div>
      <SettingsForm business={business} />
    </div>
  );
}
