import { getOwnerBusiness } from "@/lib/dal";
import SettingsForm from "./SettingsForm";

export default async function SettingsPage() {
  const business = await getOwnerBusiness();
  if (!business) return null;

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-xl font-bold">Business settings</h1>
      <SettingsForm business={business} />
    </div>
  );
}
