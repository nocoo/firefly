import { notFound } from "next/navigation";
import { PodcastCard } from "@/components/blog/podcast-card";
import { parseHisFmCardPayload } from "@/lib/hisfm/card-schema";
import { mockHisFmCardPayload } from "@/lib/hisfm/fixtures";
import { buildPodcastCardViewModel } from "@/models/podcast-card-vm";

/** Dev-only visual fixture for podcast card screenshots (not linked in production). */
export default function PodcastCardFixturePage() {
  if (process.env.NODE_ENV === "production") notFound();
  const card = parseHisFmCardPayload(mockHisFmCardPayload());
  if (!card) notFound();
  const model = buildPodcastCardViewModel(card);
  return (
    <div className="blog-shell journal-theme mx-auto max-w-xl p-8">
      <PodcastCard model={model} />
    </div>
  );
}
