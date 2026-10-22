import { notFound } from "next/navigation";
import { ArticleBody } from "@/components/blog/article-body";
import { PodcastPlayer } from "@/components/blog/podcast-player";
import { FeaturedImage } from "@/components/blog/featured-image";
import {
  fixtureEp02Published,
  fixtureEp03Published,
} from "@/lib/hisfm/fixtures";
import { isPodcastPostPreviewAllowed } from "@/lib/preview-gate";

interface PageProps {
  searchParams: Promise<{ episode?: string; cover?: string }>;
}

/** Dev-only, recorded API fixtures: no production post or live API dependency. */
export default async function PodcastPostPreviewPage({ searchParams }: PageProps) {
  if (!isPodcastPostPreviewAllowed()) notFound();
  const { episode = "ep03", cover } = await searchParams;
  const fixture = episode === "ep02" ? fixtureEp02Published() : fixtureEp03Published();
  const { audio: _audio, ...withoutAudio } = fixture;
  const card = episode === "silent" ? withoutAudio : fixture;

  return (
    <div className="blog-shell journal-theme min-h-screen">
      <div className="journal-article-layout mx-auto max-w-3xl px-[var(--blog-content-padding)] py-12">
        <ArticleBody
          className="journal-article"
          html="<p>这是一段示例正文，用于预览播客播放器在真实文章版式中的位置。播放器位于封面图下方，与线上文章页一致。</p>"
          header={
            <header className="journal-article-header">
              <p className="journal-eyebrow" lang="en">
                <span /> THE JOURNAL / FIELD NOTES
              </p>
              <h1 className="text-2xl font-bold leading-tight text-blog-text md:text-3xl">
                播客播放器预览
              </h1>
              <div className="blog-byline">
                <span className="blog-byline-item">李政</span>
                <span className="blog-byline-item">
                  <time dateTime="2026-10-21">2026年10月21日</time>
                </span>
              </div>
            </header>
          }
          featuredImage={cover === "none" ? undefined : <FeaturedImage src={fixture.cover.url} alt="播客文章封面" priority />}
          podcastPlayer={<PodcastPlayer card={card} />}
        />
      </div>
    </div>
  );
}
