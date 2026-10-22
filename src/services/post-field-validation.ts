import { validatePodcastEpisodeUrl } from "@/lib/hisfm/podcast-url";

export class PostFieldValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PostFieldValidationError";
  }
}

export function assertValidPodcastUrlInput(
  podcastUrl: string | null | undefined,
): void {
  if (podcastUrl === undefined || podcastUrl === null) return;
  const message = validatePodcastEpisodeUrl(podcastUrl);
  if (message) throw new PostFieldValidationError(message);
}
