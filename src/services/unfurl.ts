// ---------------------------------------------------------------------------
// URL unfurl service — fetch + extract OG metadata with SSRF protection.
//
// Implementation split across:
//   - unfurl-types.ts   (UnfurlError, UnfurlRawResult)
//   - unfurl-ssrf.ts    (validateUrl, resolveAndValidateHostname, private-IP detection)
//   - unfurl-fetch.ts   (fetchHtml with SSRF-checked redirect following)
//   - unfurl-extract.ts (extractOgMetadata, extractBodyText)
//   - unfurl-github.ts  (fetchGitHubReadmeImage)
// ---------------------------------------------------------------------------

import { fetchHtml } from "./unfurl-fetch";
import { extractBodyText, extractOgMetadata } from "./unfurl-extract";
import { fetchGitHubReadmeImage } from "./unfurl-github";
import { validateUrl } from "./unfurl-ssrf";
import type { UnfurlRawResult } from "./unfurl-types";

export type { UnfurlRawResult } from "./unfurl-types";
export { UnfurlError } from "./unfurl-types";
export { validateUrl, resolveAndValidateHostname } from "./unfurl-ssrf";
export { fetchHtml } from "./unfurl-fetch";
export { extractOgMetadata, extractBodyText } from "./unfurl-extract";
export { fetchGitHubReadmeImage } from "./unfurl-github";

export async function unfurlUrl(url: string): Promise<UnfurlRawResult> {
  validateUrl(url);

  const html = await fetchHtml(url);
  const og = extractOgMetadata(html);
  const bodyText = extractBodyText(html);

  // Resolve relative og:image to absolute URL
  const ogImage = og.ogImage ? new URL(og.ogImage, url).href : null;

  // Best-effort GitHub README image fallback
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
