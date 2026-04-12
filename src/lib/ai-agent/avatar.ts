// ---------------------------------------------------------------------------
// AI Agent avatar URL helpers — server-only
//
// Depends on r2-client.ts (reads R2_PUBLIC_URL env var). Must NOT be imported
// by client components. Client components receive pre-computed avatar URLs
// as props from their parent server components.
// ---------------------------------------------------------------------------

import "server-only";
import { getR2PublicUrl } from "../r2-client";
import { getR2KeyPrefix } from "../r2";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

export type AvatarSize = 32 | 64 | 128 | 256;
export const AVATAR_SIZES: AvatarSize[] = [32, 64, 128, 256];

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
 * @example getAgentAvatarUrl("claude-daily", "a1b2c3d4", 64)
 * // → "https://cdn.example.com/uploads/firefly/agents/claude-daily/a1b2c3d4/avatar-64.png"
 */
export function getAgentAvatarUrl(
  agentSlug: string,
  avatarVersion: string | null,
  size: AvatarSize,
): string | null {
  if (!avatarVersion) return null;
  return `${getR2PublicUrl()}/${getAvatarBasePath()}/${agentSlug}/${avatarVersion}/avatar-${size}.png`;
}

/**
 * Build the R2 object key for an agent avatar variant (no CDN prefix).
 */
export function getAgentAvatarR2Key(
  agentSlug: string,
  version: string,
  size: AvatarSize,
): string {
  return `${getAvatarBasePath()}/${agentSlug}/${version}/avatar-${size}.png`;
}

/**
 * Get all R2 keys for a specific avatar version (for deletion).
 */
export function getAllAvatarR2Keys(
  agentSlug: string,
  version: string,
): string[] {
  return AVATAR_SIZES.map((size) => getAgentAvatarR2Key(agentSlug, version, size));
}
