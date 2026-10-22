import { notFound } from "next/navigation";
import { ArticleBody } from "@/components/blog/article-body";
import { PodcastCardSection } from "@/components/blog/podcast-card-section";
import {
  FIXTURE_EPISODE_URL_EP02,
  FIXTURE_EPISODE_URL_EP03,
} from "@/lib/hisfm/fixtures";

const EPISODES: Record<string, string> = {
  ep02: FIXTURE_EPISODE_URL_EP02,
  ep03: FIXTURE_EPISODE_URL_EP03,
};

interface PageProps {
  searchParams: Promise<{ episode?: string }>;
}

/** Dev-only: journal article shell with live his.fm card (no DB post required). */
export default async function PodcastPostPreviewPage({ searchParams }: PageProps) {
  if (process.env.NODE_ENV === "production") notFound();
  const { episode = "ep03" } = await searchParams;
  const podcastUrl = EPISODES[episode] ?? EPISODES.ep03;

  return (
    <div className="blog-shell journal-theme min-h-screen">
      <div className="journal-article-layout mx-auto max-w-3xl px-[var(--blog-content-padding)] py-12">
        <ArticleBody
          className="journal-article"
          html="<p>这是一段示例正文，用于预览播客卡片在真实文章版式中的位置与层次。卡片位于标题与特色图之间，与线上文章页一致。</p>"
          header={
            <header className="journal-article-header">
              <p className="journal-eyebrow" lang="en">
                <span /> THE JOURNAL / FIELD NOTES
              </p>
              <h1 className="text-2xl font-bold leading-tight text-blog-text md:text-3xl">
                播客卡片预览
              </h1>
              <div className="blog-byline">
                <span className="blog-byline-item">李政</span>
                <span className="blog-byline-item">
                  <time dateTime="2026-10-21">2026年10月21日</time>
                </span>
              </div>
            </header>
          }
          podcastCard={<PodcastCardSection podcastUrl={podcastUrl} />}
        />
      </div>
    </div>
  );
}
