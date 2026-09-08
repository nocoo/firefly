import Link from "next/link";

export const journalSurfaceUrls = {
  play: process.env.NODE_ENV === "development" ? "https://lizheng-me.dev.hexly.ai/" : "https://lizheng.me/",
  resume: process.env.NODE_ENV === "development" ? "https://lizheng-dev.dev.hexly.ai/" : "https://lizheng.dev/",
  portfolio: "https://hexly.ai",
};

const SURFACES = [
  { id: "play", name: "Play", href: journalSurfaceUrls.play },
  { id: "blog", name: "Journal", href: "/" },
  { id: "resume", name: "Résumé", href: journalSurfaceUrls.resume },
  { id: "portfolio", name: "Portfolio", href: journalSurfaceUrls.portfolio },
] as const;

export function JournalSurfaces({ inert }: { inert?: boolean }) {
  return (
    <nav className="journal-surfaces" aria-label="访问面" inert={inert}>
      {SURFACES.map((surface) =>
        surface.id === "blog" ? (
          <Link
            key={surface.id}
            href={surface.href}
            prefetch={false}
            aria-current="true"
            lang="en"
          >
            {surface.name}
          </Link>
        ) : (
          <a key={surface.id} href={surface.href} lang="en">
            {surface.name}
          </a>
        ),
      )}
    </nav>
  );
}
