import type { Db } from "@/lib/db";
import { getSiteSettings, getDefaultHuman } from "@/data/public-content";
import type { SiteSettings } from "@/data/settings";
import { toSiteIdentity, type SiteIdentity } from "@/lib/seo";

export async function loadSiteIdentity(
  db: Db,
  settings?: SiteSettings,
): Promise<{ settings: SiteSettings; identity: SiteIdentity }> {
  const resolved = settings ?? (await getSiteSettings(db));
  const human = await getDefaultHuman(db, resolved.defaultHumanId);
  return {
    settings: resolved,
    identity: {
      ...toSiteIdentity(resolved, human?.name ?? resolved.siteName),
      // Public owner profiles, also linked by the Journal's site navigation.
      sameAs: [...new Set([
        "https://lizheng.me/",
        "https://lizheng.dev/",
        "https://lizheng.blog/",
        "https://hexly.ai/",
        ...resolved.socialLinks.map((link) => link.url).filter((url) => /^https?:\/\//i.test(url)),
      ])],
    },
  };
}
