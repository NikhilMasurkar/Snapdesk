import { redirect } from "next/navigation";
import { getOwnerBusiness, getOwnerFeatures } from "@/lib/dal";

export default async function DashboardIndex() {
  const business = await getOwnerBusiness();
  // Tables is the owner's main service screen; counter-mode falls back to Menu.
  if (business) {
    const features = await getOwnerFeatures(business.id);
    if (features.tables_enabled) redirect("/dashboard/tables");
  }
  redirect("/dashboard/menu");
}
