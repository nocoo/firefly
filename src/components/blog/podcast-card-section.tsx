import { loadHisFmPodcastCard } from "@/lib/hisfm/fetch-card.server";
import { buildPodcastCardViewModel } from "@/models/podcast-card-vm";
import { PodcastCard } from "@/components/blog/podcast-card";

interface PodcastCardSectionProps {
  podcastUrl: string | null;
}

/**
 * Server wrapper: fetches his.fm card data and renders the client player, or nothing.
 */
export async function PodcastCardSection({ podcastUrl }: PodcastCardSectionProps) {
  const card = await loadHisFmPodcastCard(podcastUrl);
  if (!card) return null;
  const model = buildPodcastCardViewModel(card);
  if (!model.coverUrl) return null;
  return <PodcastCard model={model} />;
}
