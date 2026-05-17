// ---------------------------------------------------------------------------
// SSRF protection — URL validation + DNS resolution checks
// ---------------------------------------------------------------------------

import dns from "node:dns";
import { UnfurlError } from "./unfurl-types";

const DNS_TIMEOUT_MS = 5_000;
const IP_LITERAL_RE = /^[\d.]+$|^\[/; // IPv4 literal or bracketed IPv6

// Private network CIDR ranges (IPv4) — single-octet prefixes
const PRIVATE_IPV4_PREFIXES = ["127.", "10.", "0.", "169.254."] as const;

function isPrivateIPv4(hostname: string): boolean {
  for (const prefix of PRIVATE_IPV4_PREFIXES) {
    if (hostname.startsWith(prefix)) return true;
  }

  // 172.16.0.0/12 — 172.16.x.x through 172.31.x.x
  if (hostname.startsWith("172.")) {
    const secondOctet = parseInt(hostname.split(".")[1], 10);
    if (secondOctet >= 16 && secondOctet <= 31) return true;
  }

  // 192.168.0.0/16
  if (hostname.startsWith("192.168.")) return true;

  return false;
}

function isPrivateIPv6(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (lower === "::1") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // fc00::/7
  if (lower === "::") return true;
  return false;
}

/** Whether the given hostname/IP literal is a private/loopback address. */
function isPrivateHost(host: string): boolean {
  return (
    host === "localhost" || isPrivateIPv4(host) || isPrivateIPv6(host)
  );
}

export function validateUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new UnfurlError("Invalid URL format", 400);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new UnfurlError(
      `URL not allowed: protocol "${parsed.protocol}" is not permitted`,
      400,
    );
  }

  if (isPrivateHost(parsed.hostname)) {
    throw new UnfurlError("URL not allowed: private network", 400);
  }

  return parsed;
}

/**
 * Resolve a hostname via DNS and verify **all** resolved IPs are not private.
 * IP-literal hostnames are skipped (already checked by validateUrl).
 *
 * Uses `all: true` so that dual-stacked domains that mix public and private
 * addresses (e.g. a public A record + a private AAAA record) are still caught.
 */
export async function resolveAndValidateHostname(
  hostname: string,
): Promise<void> {
  // IP literals are already validated by validateUrl — no DNS needed
  if (IP_LITERAL_RE.test(hostname)) return;

  let addresses: dns.LookupAddress[];
  let dnsTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      dns.promises.lookup(hostname, { family: 0, all: true }),
      new Promise<never>((_, reject) => {
        dnsTimer = setTimeout(
          () => reject(new Error("DNS timeout")),
          DNS_TIMEOUT_MS,
        );
      }),
    ]);
    addresses = result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "DNS resolution failed";
    throw new UnfurlError(`DNS resolution failed: ${msg}`, 400);
  } finally {
    clearTimeout(dnsTimer);
  }

  for (const entry of addresses) {
    // Normalize IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1 → 127.0.0.1)
    const normalized = entry.address.startsWith("::ffff:")
      ? entry.address.slice(7)
      : entry.address;

    if (isPrivateHost(normalized)) {
      throw new UnfurlError(
        "URL not allowed: resolves to private network",
        400,
      );
    }
  }
}
