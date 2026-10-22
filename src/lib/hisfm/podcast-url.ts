/** his.fm episode page URLs stored on posts.podcast_url / podcastUrl. */

const EPISODE_PATH_RE = /^\/episodes\/[^/]+\/[^/]+\/?$/;

export const PODCAST_URL_ERROR =
  "podcast_url must be an https URL on host his.fm with path /episodes/<column>/<slug>";

export function isValidPodcastEpisodeUrl(value: string): boolean {
  return validatePodcastEpisodeUrl(value) === null;
}

/** Returns an error message when invalid, or null when valid. */
export function validatePodcastEpisodeUrl(value: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return PODCAST_URL_ERROR;
  }
  if (parsed.protocol !== "https:") return PODCAST_URL_ERROR;
  if (parsed.hostname !== "his.fm") return PODCAST_URL_ERROR;
  if (!EPISODE_PATH_RE.test(parsed.pathname)) return PODCAST_URL_ERROR;
  return null;
}
