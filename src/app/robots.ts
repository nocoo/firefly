import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Single wildcard rule covers all bots (search engines + AI bots).
      // Per the robots.txt spec, a bot-specific group *replaces* the
      // wildcard group — it does not inherit from it. Separate groups for
      // Googlebot/Bingbot/etc. with only `allow: "/"` would remove the
      // disallow directives for those bots, so we intentionally rely on
      // the wildcard rule only.
      {
        userAgent: "*",
        allow: ["/", "/api/favicon"],
        disallow: ["/api/", "/admin/", "/login"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
