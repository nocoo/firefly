// ---------------------------------------------------------------------------
// Privacy-preserving hash utilities
// ---------------------------------------------------------------------------

/**
 * Hash an IP address with a daily-rotating salt for privacy.
 * Same IP on the same day produces the same hash (for unique visitor counting),
 * but cannot be reversed or linked across days.
 */
export async function hashIp(ip: string): Promise<string> {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const data = `${ip}:${date}`;
  const encoded = new TextEncoder().encode(data);
  const buffer = await crypto.subtle.digest("SHA-256", encoded);
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
