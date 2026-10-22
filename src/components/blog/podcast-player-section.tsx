import { loadHisFmPodcastCard } from "@/lib/hisfm/fetch-card.server";
import { PodcastPlayer } from "@/components/blog/podcast-player";

interface PodcastPlayerSectionProps {
  podcastUrl: string | null;
}

/**
 * Fetches metadata without making article rendering depend on its availability.
 */
export async function PodcastPlayerSection({ podcastUrl }: PodcastPlayerSectionProps) {
  const card = await loadHisFmPodcastCard(podcastUrl);
  if (!card) return null;
  return <PodcastPlayer card={card} />;
}
