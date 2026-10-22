/** HTTPS media URLs allowed in his.fm /api/card v1 responses. */

export const HISFM_MEDIA_HOSTS = ["f.no.mt", "his.fm"] as const;

const DISALLOWED_MEDIA_CHARS = /[\s,]/;

export function isHisFmCardMediaUrl(value: string): boolean {
  return parseHisFmCardMediaUrl(value) !== null;
}

/** Returns canonical `href` when allowed, else null (rejects srcset injection). */
export function parseHisFmCardMediaUrl(value: string): string | null {
  if (DISALLOWED_MEDIA_CHARS.test(value)) return null;
  if (!value.startsWith("https://")) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return null;
    if (parsed.username || parsed.password) return null;
    if (parsed.port) return null;
    if (parsed.search || parsed.hash) return null;
    if (!(HISFM_MEDIA_HOSTS as readonly string[]).includes(parsed.hostname)) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}
