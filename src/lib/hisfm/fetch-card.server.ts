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

async function fetchCardUncached(
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
    if (!response.ok) {
      console.warn(
        `[hisfm] card fetch failed (${response.status}) for ${podcastUrl}`,
      );
      return null;
    }
    const json: unknown = await response.json();
    const card = parseHisFmCardPayload(json);
    if (!card) {
      console.warn(`[hisfm] card payload invalid or not published for ${podcastUrl}`);
      return null;
    }
    return card;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[hisfm] card fetch error for ${podcastUrl}: ${msg}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function cachedFetch(podcastUrl: string): Promise<HisFmPublishedCard | null> {
  return unstable_cache(
    () => fetchCardUncached(podcastUrl),
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
    console.warn(`[hisfm] card cache error for ${trimmed}: ${msg}`);
    return null;
  }
}

export { CACHE_TAG as HISFM_PODCAST_CARD_CACHE_TAG };
