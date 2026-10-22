import { loadHisFmPodcastCard } from "@/lib/hisfm/fetch-card.server";
import { PodcastCard } from "@/components/blog/podcast-card";

interface PodcastCardSectionProps {
  podcastUrl: string | null;
}

/**
 * Server wrapper: fetches his.fm card data and renders the client card, or nothing.
 */
export async function PodcastCardSection({ podcastUrl }: PodcastCardSectionProps) {
  const card = await loadHisFmPodcastCard(podcastUrl);
  if (!card) return null;
  return <PodcastCard card={card} />;
}
