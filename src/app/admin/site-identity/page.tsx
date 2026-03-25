import { getDb } from "@/lib/db";
import { getSiteSettings } from "@/data/settings";
import { SiteIdentityForm } from "@/components/admin/site-identity-form";
import { getLogoUrl } from "@/lib/logo";

export default async function SiteIdentityPage() {
  const db = getDb();
  const settings = await getSiteSettings(db);
  const logoUrl = settings.siteLogoVersion
    ? getLogoUrl(settings.siteLogoVersion, 80)
    : null;

  return <SiteIdentityForm settings={settings} logoUrl={logoUrl} />;
}
