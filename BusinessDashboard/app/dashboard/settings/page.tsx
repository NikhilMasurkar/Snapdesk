import { getOwnerBusiness, getOwnerFeatures } from "@/lib/dal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import QrPackButton from "@/components/dashboard/QrPackButton";
import SettingsForm from "./SettingsForm";

const MENU_BASE_URL =
  process.env.NEXT_PUBLIC_MENU_BASE_URL ?? "https://snapdesk-tan.vercel.app";

export default async function SettingsPage() {
  const business = await getOwnerBusiness();
  if (!business) return null; // layout already handles this case

  const features = await getOwnerFeatures(business.id);

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

      <Card>
        <CardHeader>
          <CardTitle>Table QR codes</CardTitle>
        </CardHeader>
        <CardContent>
          {features.qr_download_enabled ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                A print-ready A4 PDF with a QR code for each of your{" "}
                {business.table_count} tables plus a counter code.
              </p>
              <div>
                <QrPackButton
                  slug={business.slug}
                  businessName={business.name}
                  tableCount={business.table_count}
                  menuBaseUrl={MENU_BASE_URL}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Need QR codes or reprints? Contact us and we&apos;ll send your
              printable pack.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
