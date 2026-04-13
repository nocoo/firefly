// ---------------------------------------------------------------------------
// AI Agent avatar utilities — server-only
//
// Depends on r2-client.ts (reads R2_PUBLIC_URL env var). Must NOT be imported
// by client components. Client components receive pre-computed avatar URLs
// as props from their parent server components.
//
// STORAGE PATH: agents/{agentId}/{version}/avatar-{size}.jpg
//
// We use agent ID (not slug) in paths to ensure stability when slug changes.
// This design was established when the feature was first implemented — no
// migration needed since there was never a slug-based storage scheme in prod.
// ---------------------------------------------------------------------------

import "server-only";
import { getR2PublicUrl } from "../r2-client";
import { getR2KeyPrefix } from "../r2";
import {
  buildAgentAvatarUrl,
  AVATAR_SIZES,
  type AvatarSize,
} from "./avatar-url";

// Re-export types for convenience
export { AVATAR_SIZES, type AvatarSize } from "./avatar-url";

function getAvatarBasePath(): string {
  return `${getR2KeyPrefix()}agents`;
}

// ---------------------------------------------------------------------------
// URL builders
// ---------------------------------------------------------------------------

/**
 * Build the public CDN URL for an agent avatar variant.
 * Returns null if avatarVersion is null (agent has no avatar).
 *
 * @param agentId - The agent's stable ID (not slug)
 * @param avatarVersion - The avatar version or null
 * @param size - The avatar size
 *
 * @example getAgentAvatarUrl("01HQ...", "a1b2c3d4", 64)
 * // → "https://cdn.example.com/uploads/firefly/agents/01HQ.../a1b2c3d4/avatar-64.jpg"
 */
export function getAgentAvatarUrl(
  agentId: string,
  avatarVersion: string | null,
  size: AvatarSize,
): string | null {
  return buildAgentAvatarUrl(
    getR2PublicUrl(),
    getR2KeyPrefix(),
    agentId,
    avatarVersion,
    size,
  );
}

/**
 * Build the R2 object key for an agent avatar variant (no CDN prefix).
 *
 * @param agentId - The agent's stable ID (not slug)
 */
export function getAgentAvatarR2Key(
  agentId: string,
  version: string,
  size: AvatarSize,
): string {
  return `${getAvatarBasePath()}/${agentId}/${version}/avatar-${size}.jpg`;
}

/**
 * Get all R2 keys for a specific avatar version (for deletion).
 *
 * @param agentId - The agent's stable ID (not slug)
 */
export function getAllAvatarR2Keys(
  agentId: string,
  version: string,
): string[] {
  return AVATAR_SIZES.map((size) => getAgentAvatarR2Key(agentId, version, size));
}
