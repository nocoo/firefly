// ---------------------------------------------------------------------------
// HTML fetch with SSRF-checked redirect following + response-size cap
// ---------------------------------------------------------------------------

import { UnfurlError } from "./unfurl-types";
import { resolveAndValidateHostname, validateUrl } from "./unfurl-ssrf";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_REDIRECTS = 5;
export const USER_AGENT = "FireflyBot/1.0 (link preview)";

/** Read the response body, capped at MAX_RESPONSE_BYTES, decoded as UTF-8. */
async function readBodyWithCap(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new UnfurlError("No response body", 502);

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_RESPONSE_BYTES) {
      reader.cancel();
      chunks.push(
        value.slice(0, value.byteLength - (totalBytes - MAX_RESPONSE_BYTES)),
      );
      break;
    }
    chunks.push(value);
  }

  const combined = new Uint8Array(
    chunks.reduce((acc, c) => acc + c.byteLength, 0),
  );
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(combined);
}

/** Perform a single fetch hop with timeout. Throws UnfurlError on transport failure. */
async function fetchHopRaw(href: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(href, {
      method: "GET",
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
      redirect: "manual",
    });
  } catch (err) {
    if (err instanceof UnfurlError) throw err;
    const message = err instanceof Error ? err.message : "Unknown fetch error";
    throw new UnfurlError(`Failed to fetch URL: ${message}`, 502);
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchHtml(url: string): Promise<string> {
  let currentUrl = url;

  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const parsed = validateUrl(currentUrl);
    await resolveAndValidateHostname(parsed.hostname);

    const response = await fetchHopRaw(parsed.href);

    // Manual redirect handling — re-validate each hop against SSRF
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new UnfurlError("Redirect without Location header", 502);
      }
      currentUrl = new URL(location, currentUrl).href;
      continue;
    }

    if (!response.ok) {
      throw new UnfurlError(
        `Failed to fetch URL: HTTP ${response.status}`,
        502,
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      throw new UnfurlError(
        `Unsupported content type: ${contentType || "none"}`,
        502,
      );
    }

    return readBodyWithCap(response);
  }

  throw new UnfurlError("Too many redirects", 502);
}
