import Link from "next/link";

export const journalSurfaceUrls = {
  play: process.env.NODE_ENV === "development" ? "https://lizheng-me.dev.hexly.ai/" : "https://lizheng.me/",
  resume: process.env.NODE_ENV === "development" ? "https://lizheng-dev.dev.hexly.ai/" : "https://lizheng.dev/",
};

export function JournalSurfaces({ inert }: { inert?: boolean }) {
  return (
    <nav className="journal-surfaces" aria-label="访问面" inert={inert}>
      <Link href="/" prefetch={false} aria-current="true" lang="en">Journal</Link>
      <a href={journalSurfaceUrls.play} lang="en">Play <span aria-hidden="true">↗</span></a>
      <a href={journalSurfaceUrls.resume} lang="en">Résumé <span aria-hidden="true">↗</span></a>
    </nav>
  );
}
