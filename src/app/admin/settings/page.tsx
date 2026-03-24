import { getDb } from "@/lib/db";
import { getSiteSettings } from "@/data/settings";
import { SettingsForm } from "@/components/admin/settings-form";
import { getLogoUrl } from "@/lib/logo";

export default async function SettingsPage() {
  const db = getDb();
  const settings = await getSiteSettings(db);
  const logoUrl = settings.siteLogoVersion
    ? getLogoUrl(settings.siteLogoVersion, 80)
    : null;

  return <SettingsForm settings={settings} logoUrl={logoUrl} />;
}
