// ---------------------------------------------------------------------------
// URL unfurl service — fetch + extract OG metadata with SSRF protection
// ---------------------------------------------------------------------------

import dns from "node:dns";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UnfurlRawResult {
  url: string;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  pageTitle: string | null;
  bodyText: string;
  readmeImage: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FETCH_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_REDIRECTS = 5;
const USER_AGENT = "FireflyBot/1.0 (link preview)";
const MAX_UNFURL_BODY_CHARS = 3000;

// Private network CIDR ranges (IPv4)
const PRIVATE_IPV4_RANGES = [
  { prefix: "127.", mask: null },
  { prefix: "10.", mask: null },
  { prefix: "0.", mask: null },
  { prefix: "169.254.", mask: null },
] as const;

// ---------------------------------------------------------------------------
// URL validation (SSRF protection)
// ---------------------------------------------------------------------------

function isPrivateIPv4(hostname: string): boolean {
  // Simple prefix checks
  for (const range of PRIVATE_IPV4_RANGES) {
    if (hostname.startsWith(range.prefix)) return true;
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

export function validateUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new UnfurlError("Invalid URL format", 400);
  }

  // Protocol whitelist
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new UnfurlError(
      `URL not allowed: protocol "${parsed.protocol}" is not permitted`,
      400,
    );
  }

  // Private network guard
  const hostname = parsed.hostname;
  if (hostname === "localhost" || isPrivateIPv4(hostname) || isPrivateIPv6(hostname)) {
    throw new UnfurlError("URL not allowed: private network", 400);
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// DNS resolution validation (prevents DNS rebinding attacks)
// ---------------------------------------------------------------------------

const DNS_TIMEOUT_MS = 5_000;

const IP_LITERAL_RE = /^[\d.]+$|^\[/; // IPv4 literal or bracketed IPv6

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
        dnsTimer = setTimeout(() => reject(new Error("DNS timeout")), DNS_TIMEOUT_MS);
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

    if (
      normalized === "localhost" ||
      isPrivateIPv4(normalized) ||
      isPrivateIPv6(normalized)
    ) {
      throw new UnfurlError("URL not allowed: resolves to private network", 400);
    }
  }
}

// ---------------------------------------------------------------------------
// Custom error
// ---------------------------------------------------------------------------

export class UnfurlError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "UnfurlError";
  }
}

// ---------------------------------------------------------------------------
// HTML fetch with redirect following + SSRF checks at each hop
// ---------------------------------------------------------------------------

export async function fetchHtml(url: string): Promise<string> {
  let currentUrl = url;

  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const parsed = validateUrl(currentUrl);
    await resolveAndValidateHostname(parsed.hostname);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(parsed.href, {
        method: "GET",
        headers: { "User-Agent": USER_AGENT },
        signal: controller.signal,
        redirect: "manual",
      });
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof UnfurlError) throw err;
      const message = err instanceof Error ? err.message : "Unknown fetch error";
      throw new UnfurlError(`Failed to fetch URL: ${message}`, 502);
    } finally {
      clearTimeout(timeout);
    }

    // Handle redirects manually (validate each hop against SSRF)
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new UnfurlError("Redirect without Location header", 502);
      }
      // Resolve relative redirects
      currentUrl = new URL(location, currentUrl).href;
      continue;
    }

    if (!response.ok) {
      throw new UnfurlError(
        `Failed to fetch URL: HTTP ${response.status}`,
        502,
      );
    }

    // Content-Type gate
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      throw new UnfurlError(
        `Unsupported content type: ${contentType || "none"}`,
        502,
      );
    }

    // Read body with size limit
    const reader = response.body?.getReader();
    if (!reader) {
      throw new UnfurlError("No response body", 502);
    }

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_RESPONSE_BYTES) {
        reader.cancel();
        // Truncate — still process what we have
        chunks.push(value.slice(0, value.byteLength - (totalBytes - MAX_RESPONSE_BYTES)));
        break;
      }
      chunks.push(value);
    }

    const decoder = new TextDecoder("utf-8", { fatal: false });
    const combined = new Uint8Array(
      chunks.reduce((acc, c) => acc + c.byteLength, 0),
    );
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return decoder.decode(combined);
  }

  throw new UnfurlError("Too many redirects", 502);
}

// ---------------------------------------------------------------------------
// OG metadata extraction (regex-based, no DOM parser dependency)
// ---------------------------------------------------------------------------

interface OgMetadata {
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  pageTitle: string | null;
}

export function extractOgMetadata(html: string): OgMetadata {
  const getOgContent = (property: string): string | null => {
    // Handle both attribute orders and both quote types:
    // <meta property="og:title" content="...">  (double-quoted)
    // <meta property='og:title' content='...'>  (single-quoted)
    // <meta content="..." property="og:title">  (reversed)
    const patterns = [
      new RegExp(
        `<meta[^>]+property=["']${property}["'][^>]+content="([^"]*)"`,
        "i",
      ),
      new RegExp(
        `<meta[^>]+property=["']${property}["'][^>]+content='([^']*)'`,
        "i",
      ),
      new RegExp(
        `<meta[^>]+content="([^"]*)"[^>]+property=["']${property}["']`,
        "i",
      ),
      new RegExp(
        `<meta[^>]+content='([^']*)'[^>]+property=["']${property}["']`,
        "i",
      ),
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return decodeHtmlEntities(match[1]);
    }
    return null;
  };

  // Also try <meta name="..."> for description fallback
  const getMetaName = (name: string): string | null => {
    const patterns = [
      new RegExp(
        `<meta[^>]+name=["']${name}["'][^>]+content="([^"]*)"`,
        "i",
      ),
      new RegExp(
        `<meta[^>]+name=["']${name}["'][^>]+content='([^']*)'`,
        "i",
      ),
      new RegExp(
        `<meta[^>]+content="([^"]*)"[^>]+name=["']${name}["']`,
        "i",
      ),
      new RegExp(
        `<meta[^>]+content='([^']*)'[^>]+name=["']${name}["']`,
        "i",
      ),
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return decodeHtmlEntities(match[1]);
    }
    return null;
  };

  // <title> tag fallback
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const pageTitle = titleMatch?.[1]
    ? decodeHtmlEntities(titleMatch[1].trim())
    : null;

  return {
    ogTitle: getOgContent("og:title"),
    ogDescription: getOgContent("og:description") ?? getMetaName("description"),
    ogImage: getOgContent("og:image"),
    pageTitle,
  };
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");
}

// ---------------------------------------------------------------------------
// Body text extraction (strip HTML tags, collapse whitespace)
// ---------------------------------------------------------------------------

export function extractBodyText(html: string): string {
  // Remove <script>, <style>, <noscript> blocks
  let text = html.replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, "");

  // Remove all HTML tags
  text = text.replace(/<[^>]+>/g, " ");

  // Decode common entities
  text = decodeHtmlEntities(text);

  // Collapse whitespace
  text = text.replace(/\s+/g, " ").trim();

  // Truncate to MAX_UNFURL_BODY_CHARS
  if (text.length > MAX_UNFURL_BODY_CHARS) {
    text = text.slice(0, MAX_UNFURL_BODY_CHARS);
  }

  return text;
}

// ---------------------------------------------------------------------------
// GitHub README image extraction (best-effort)
// ---------------------------------------------------------------------------

const GITHUB_REPO_RE = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/?$/;

// GitHub special paths that are not repositories
const GITHUB_SPECIAL_PATHS = new Set(["gist", "settings", "notifications", "explore", "topics", "trending", "collections", "sponsors", "orgs", "features"]);

export async function fetchGitHubReadmeImage(
  url: string,
): Promise<string | null> {
  const match = url.match(GITHUB_REPO_RE);
  if (!match) return null;

  const [, owner, repo] = match;
  // Exclude special GitHub paths that look like repos but aren't
  if (GITHUB_SPECIAL_PATHS.has(owner)) return null;
  const cleanRepo = repo.replace(/\.git$/, "");

  // Try main then master
  for (const branch of ["main", "master"]) {
    try {
      const readmeUrl = `https://raw.githubusercontent.com/${owner}/${cleanRepo}/${branch}/README.md`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(readmeUrl, {
        headers: { "User-Agent": USER_AGENT },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) continue;

      const text = await response.text();

      // Extract first markdown image: ![alt](url)
      const imgMatch = text.match(/!\[[^\]]*\]\(([^)]+)\)/);
      if (!imgMatch?.[1]) continue;

      let imageUrl = imgMatch[1];

      // Resolve relative URLs
      if (!imageUrl.startsWith("http")) {
        // Remove leading ./
        imageUrl = imageUrl.replace(/^\.\//, "");
        imageUrl = `https://raw.githubusercontent.com/${owner}/${cleanRepo}/${branch}/${imageUrl}`;
      }

      return imageUrl;
    } catch {
      // Silent failure — best-effort
      continue;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main unfurl function
// ---------------------------------------------------------------------------

export async function unfurlUrl(url: string): Promise<UnfurlRawResult> {
  validateUrl(url);

  const html = await fetchHtml(url);
  const og = extractOgMetadata(html);
  const bodyText = extractBodyText(html);

  // Resolve relative og:image to absolute URL
  const ogImage = og.ogImage ? new URL(og.ogImage, url).href : null;

  // Best-effort GitHub README image
  let readmeImage: string | null = null;
  if (!ogImage) {
    readmeImage = await fetchGitHubReadmeImage(url);
  }

  return {
    url,
    ogTitle: og.ogTitle,
    ogDescription: og.ogDescription,
    ogImage,
    pageTitle: og.pageTitle,
    bodyText,
    readmeImage,
  };
}
