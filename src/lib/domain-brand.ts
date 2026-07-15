// ---------------------------------------------------------------------------
// Domain brand mapping — icon + color for known domains
// ---------------------------------------------------------------------------

import type { LucideIcon } from "lucide-react";
import { Github, Twitter, Youtube } from "@/components/icons/brand";

export interface DomainBrand {
  Icon: LucideIcon;
  color: string;
  label: string;
}

const BRAND_MAP: Record<string, DomainBrand> = {
  "github.com": { Icon: Github, color: "#24292f", label: "GitHub" },
  "x.com": { Icon: Twitter, color: "#000000", label: "X" },
  "twitter.com": { Icon: Twitter, color: "#1da1f2", label: "Twitter" },
  "youtube.com": { Icon: Youtube, color: "#ff0000", label: "YouTube" },
  "www.youtube.com": { Icon: Youtube, color: "#ff0000", label: "YouTube" },
};

/**
 * Look up a brand icon/color for a given domain.
 * Returns undefined for unrecognized domains — caller should fall through
 * to a neutral placeholder (domain initial on muted background).
 */
export function getDomainBrand(hostname: string): DomainBrand | undefined {
  // Strip www. prefix for lookup (except youtube which we already handle)
  const bare = hostname.replace(/^www\./, "");
  return BRAND_MAP[hostname] ?? BRAND_MAP[bare];
}

/**
 * Extract the display domain from a URL string.
 * Returns hostname without www. prefix.
 */
export function getDisplayDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
