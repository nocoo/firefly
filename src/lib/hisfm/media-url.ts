/** HTTPS media URLs allowed in his.fm /api/card v1 responses. */

export const HISFM_MEDIA_HOSTS = ["f.no.mt", "his.fm"] as const;

export function isHisFmCardMediaUrl(value: string): boolean {
  if (!value.startsWith("https://")) return false;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return false;
    if (parsed.username || parsed.password) return false;
    if (parsed.port) return false;
    if (parsed.search || parsed.hash) return false;
    return (HISFM_MEDIA_HOSTS as readonly string[]).includes(parsed.hostname);
  } catch {
    return false;
  }
}
