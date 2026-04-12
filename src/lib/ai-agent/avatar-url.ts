// ---------------------------------------------------------------------------
// AI Agent avatar URL builder — client-safe
//
// Pure function that builds avatar URLs from known values. Can be imported
// by both server and client components. Does NOT read environment variables.
//
// Avatar paths use agent ID (not slug) to ensure stability when slug changes.
// ---------------------------------------------------------------------------

export type AvatarSize = 32 | 64 | 128 | 256;
export const AVATAR_SIZES: AvatarSize[] = [32, 64, 128, 256];

/**
 * Build the public CDN URL for an agent avatar variant.
 * Returns null if avatarVersion is null (agent has no avatar).
 *
 * @param cdnBaseUrl - The R2 public URL (e.g. "https://cdn.example.com")
 * @param keyPrefix - The R2 key prefix (e.g. "uploads/firefly")
 * @param agentId - The agent's stable ID (e.g. "01HQ...")
 * @param avatarVersion - The avatar version (e.g. "a1b2c3d4") or null
 * @param size - The avatar size (32, 64, 128, or 256)
 *
 * @example buildAgentAvatarUrl("https://cdn.example.com", "uploads/firefly", "01HQ...", "a1b2c3d4", 64)
 * // → "https://cdn.example.com/uploads/firefly/agents/01HQ.../a1b2c3d4/avatar-64.png"
 */
export function buildAgentAvatarUrl(
  cdnBaseUrl: string,
  keyPrefix: string,
  agentId: string,
  avatarVersion: string | null,
  size: AvatarSize,
): string | null {
  if (!avatarVersion) return null;
  return `${cdnBaseUrl}/${keyPrefix}agents/${agentId}/${avatarVersion}/avatar-${size}.png`;
}
