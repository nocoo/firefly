// ---------------------------------------------------------------------------
// AI Agent author resolution — unified helper for all author output surfaces
//
// This module depends on server-only imports (avatar.ts → r2-client.ts) and
// must NOT be imported by client components.
//
// Post author resolution logic:
// - ai_agent_id is set → Agent author (use agent avatar + name from JOIN)
// - ai_agent_id is null → Human author (use site logo + site author)
// ---------------------------------------------------------------------------

import "server-only";
import type { PostWithAgent } from "@/models/types";
import type { SiteSettings } from "@/data/settings";
import { getAgentAvatarUrl } from "./avatar";
import { getLogoUrl } from "../logo";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PostAuthor {
  type: "site" | "agent";
  name: string;
  url: string | null; // agent has no URL, site author has SITE_URL
  avatarUrl: string | null; // agent avatar or site logo
}

// ---------------------------------------------------------------------------
// getPostAuthor
// ---------------------------------------------------------------------------

/**
 * Resolve author for a post.
 *
 * If the post has ai_agent_id set, returns the agent as author (using JOINed fields).
 * Otherwise returns site author (using site settings).
 *
 * @example
 * const author = getPostAuthor(post, settings);
 * // Display author.name and author.avatarUrl
 */
export function getPostAuthor(
  post: PostWithAgent,
  settings: SiteSettings,
): PostAuthor {
  if (post.ai_agent_id && post.agent_name) {
    // AI Agent author
    return {
      type: "agent",
      name: post.agent_name,
      url: null,
      avatarUrl: getAgentAvatarUrl(post.ai_agent_id, post.agent_avatar_version, 128),
    };
  } else {
    // Human author (site owner)
    return {
      type: "site",
      name: settings.siteAuthor,
      url: null, // caller should use SITE_URL if needed
      avatarUrl: settings.siteLogoVersion
        ? getLogoUrl(settings.siteLogoVersion, 80)
        : null,
    };
  }
}

// ---------------------------------------------------------------------------
// getPostAuthorForMeta
// ---------------------------------------------------------------------------

/**
 * Get author info for metadata (Metadata.authors, OpenGraph.authors).
 *
 * Returns agent name if the post has ai_agent_id set,
 * otherwise returns site author. Always uses SITE_URL for the URL field.
 *
 * @param siteUrl - The site's URL (used for both agent and site author)
 */
export function getPostAuthorForMeta(
  post: PostWithAgent,
  settings: SiteSettings,
  siteUrl: string,
): { name: string; url: string } {
  if (post.ai_agent_id && post.agent_name) {
    return { name: post.agent_name, url: siteUrl };
  }
  return { name: settings.siteAuthor, url: siteUrl };
}
