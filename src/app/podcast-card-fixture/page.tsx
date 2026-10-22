import { notFound } from "next/navigation";
import { PodcastCard } from "@/components/blog/podcast-card";
import { fixtureEp03Published } from "@/lib/hisfm/fixtures";

/** Dev-only visual fixture for podcast card screenshots (not linked in production). */
export default function PodcastCardFixturePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="blog-shell journal-theme mx-auto max-w-xl p-8">
      <PodcastCard card={fixtureEp03Published()} />
    </div>
  );
}
