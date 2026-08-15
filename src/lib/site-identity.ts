import type { Db } from "@/lib/db";
import { getSiteSettings, type SiteSettings } from "@/data/settings";
import { getDefaultHuman } from "@/data/entities/human";
import { toSiteIdentity, type SiteIdentity } from "@/lib/seo";

export async function loadSiteIdentity(
  db: Db,
  settings?: SiteSettings,
): Promise<{ settings: SiteSettings; identity: SiteIdentity }> {
  const resolved = settings ?? (await getSiteSettings(db));
  const human = await getDefaultHuman(db);
  return {
    settings: resolved,
    identity: toSiteIdentity(resolved, human?.name ?? resolved.siteName),
  };
}
