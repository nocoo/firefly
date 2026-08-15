// ---------------------------------------------------------------------------
// Post author resolution — agent first, then human record
// ---------------------------------------------------------------------------

import "server-only";
import type { PostWithAgent } from "@/models/types";
import { getAgentAvatarUrl } from "./avatar";
import { getHumanAvatarUrl } from "../human-avatar";

export interface PostAuthor {
  type: "human" | "agent";
  id: string;
  name: string;
  slug: string;
  avatarUrl: string | null;
}

export function getPostAuthor(post: PostWithAgent): PostAuthor {
  if (post.ai_agent_id && post.agent_name) {
    return {
      type: "agent",
      id: post.ai_agent_id,
      name: post.agent_name,
      slug: post.agent_slug ?? "",
      avatarUrl: getAgentAvatarUrl(
        post.ai_agent_id,
        post.agent_avatar_version,
        128,
      ),
    };
  }
  return {
    type: "human",
    id: post.human_id ?? "",
    name: post.human_name ?? "",
    slug: post.human_slug ?? "",
    avatarUrl: post.human_id
      ? getHumanAvatarUrl(post.human_id, post.human_avatar_version, 80)
      : null,
  };
}

export function getPostAuthorForMeta(
  post: PostWithAgent,
  siteUrl: string,
): { name: string; url: string } {
  const author = getPostAuthor(post);
  return { name: author.name, url: siteUrl };
}
