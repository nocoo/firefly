import "server-only";

import { unstable_cache } from "next/cache";
import {
  parseHisFmCardPayload,
  type HisFmPublishedCard,
} from "@/lib/hisfm/card-schema";
import { isValidPodcastEpisodeUrl } from "@/lib/hisfm/podcast-url";

const HISFM_CARD_API = "https://his.fm/api/card";
const REVALIDATE_SECONDS = 300;
const FETCH_TIMEOUT_MS = 3_000;
const CACHE_TAG = "hisfm-podcast-card";

/** Thrown for transient failures — must not be written into unstable_cache. */
export class HisFmCardCacheMissError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HisFmCardCacheMissError";
  }
}

function isNotFoundPayload(json: unknown): boolean {
  return (
    typeof json === "object" &&
    json !== null &&
    "v" in json &&
    "status" in json &&
    (json as { status: string }).status === "not_found"
  );
}

/**
 * Fetch card for cache storage. Returns null only for definitive not-found (HTTP 404
 * or protocol not_found). Throws on transient errors so stale cache can serve.
 */
export async function fetchHisFmCardForCache(
  podcastUrl: string,
): Promise<HisFmPublishedCard | null> {
  const cardUrl = `${HISFM_CARD_API}?url=${encodeURIComponent(podcastUrl)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(cardUrl, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      redirect: "error",
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new HisFmCardCacheMissError(
        `hisfm card HTTP ${response.status}`,
      );
    }
    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new HisFmCardCacheMissError("hisfm card invalid JSON");
    }
    if (isNotFoundPayload(json)) return null;
    const card = parseHisFmCardPayload(json);
    if (!card) {
      throw new HisFmCardCacheMissError("hisfm card invalid published payload");
    }
    return card;
  } catch (err) {
    if (err instanceof HisFmCardCacheMissError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new HisFmCardCacheMissError("hisfm card fetch timeout");
    }
    throw new HisFmCardCacheMissError(
      err instanceof Error ? err.message : String(err),
    );
  } finally {
    clearTimeout(timeout);
  }
}

function cachedFetch(podcastUrl: string): Promise<HisFmPublishedCard | null> {
  return unstable_cache(
    () => fetchHisFmCardForCache(podcastUrl),
    ["hisfm-card-v1", podcastUrl],
    { revalidate: REVALIDATE_SECONDS, tags: [CACHE_TAG] },
  )();
}

/**
 * Load a published his.fm card for a post episode URL, or null on any failure.
 * Never throws — safe for public post pages.
 */
export async function loadHisFmPodcastCard(
  podcastUrl: string | null | undefined,
): Promise<HisFmPublishedCard | null> {
  if (typeof podcastUrl !== "string" || !podcastUrl.trim()) return null;
  const trimmed = podcastUrl.trim();
  if (!isValidPodcastEpisodeUrl(trimmed)) {
    console.warn(`[hisfm] invalid podcast_url on post: ${trimmed}`);
    return null;
  }
  try {
    return await cachedFetch(trimmed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[hisfm] card cache miss for ${trimmed}: ${msg}`);
    return null;
  }
}

export { CACHE_TAG as HISFM_PODCAST_CARD_CACHE_TAG };
