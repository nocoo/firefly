/** his.fm episode page URLs stored on posts.podcast_url / podcastUrl. */

/** Same rule as his.fm — literal match, no URL normalization. */
export const HISFM_EPISODE_URL_RE =
  /^https:\/\/his\.fm\/episodes\/[a-z0-9-]+\/[a-z0-9-]+\/?$/;

export const PODCAST_URL_ERROR =
  "podcast_url must be an https URL on host his.fm with path /episodes/<column>/<slug>";

export function isValidPodcastEpisodeUrl(value: unknown): boolean {
  return validatePodcastEpisodeUrl(value) === null;
}

/** Returns an error message when invalid, or null when valid. */
export function validatePodcastEpisodeUrl(value: unknown): string | null {
  if (typeof value !== "string") return PODCAST_URL_ERROR;
  if (!HISFM_EPISODE_URL_RE.test(value)) return PODCAST_URL_ERROR;
  return null;
}
