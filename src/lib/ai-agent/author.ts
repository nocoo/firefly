// ---------------------------------------------------------------------------
// AI Agent author resolution — unified helper for all author output surfaces
//
// This module depends on server-only imports (avatar.ts → r2-client.ts) and
// must NOT be imported by client components.
// ---------------------------------------------------------------------------

import "server-only";
import type { Db } from "@/lib/db";
import type { Post } from "@/models/types";
import { getAiAgentByCategoryId } from "@/data/entities/ai-agent";
import { getAgentAvatarUrl } from "./avatar";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PostAuthor {
  type: "site" | "agent";
  name: string;
  url: string | null; // agent has no URL, site author has SITE_URL
  avatarUrl: string | null; // agent avatar or null
}

// ---------------------------------------------------------------------------
// getPostAuthor
// ---------------------------------------------------------------------------

/**
 * Resolve author for a post.
 *
 * If the post's category is bound to an agent, returns the agent as author.
 * Otherwise returns null (caller should fall back to site author).
 *
 * @example
 * const author = await getPostAuthor(db, post);
 * if (author) {
 *   // Display agent name and avatar
 * } else {
 *   // Display site author
 * }
 */
export async function getPostAuthor(
  db: Db,
  post: Post,
): Promise<PostAuthor | null> {
  if (!post.category_id) return null;

  const agent = await getAiAgentByCategoryId(db, post.category_id);
  if (!agent) return null;

  return {
    type: "agent",
    name: agent.name,
    url: null,
    // Use agent.id (not slug) for stable avatar paths
    avatarUrl: getAgentAvatarUrl(agent.id, agent.avatar_version, 128),
  };
}

// ---------------------------------------------------------------------------
// getPostAuthorForMeta
// ---------------------------------------------------------------------------

/**
 * Get author info for metadata (Metadata.authors, OpenGraph.authors).
 *
 * Returns agent name if the post's category is bound to an agent,
 * otherwise returns site author. Always uses SITE_URL for the URL field.
 *
 * @param siteAuthor - The site's default author name
 * @param siteUrl - The site's URL (used for both agent and site author)
 */
export async function getPostAuthorForMeta(
  db: Db,
  post: Post,
  siteAuthor: string,
  siteUrl: string,
): Promise<{ name: string; url: string }> {
  const author = await getPostAuthor(db, post);
  if (author) {
    return { name: author.name, url: siteUrl };
  }
  return { name: siteAuthor, url: siteUrl };
}
