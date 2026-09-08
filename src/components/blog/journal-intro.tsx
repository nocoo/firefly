import { connection } from "next/server";
import { randomKeepsake } from "@/lib/journal-keepsake";
import { JournalKeepsake } from "./journal-keepsake";

export async function JournalIntro({ siteName, tagline, total }: { siteName: string; tagline: string; total: number }) {
  await connection();
  const initialScene = randomKeepsake();
  const slogan = (tagline.trim() || siteName).replace(/[。．.]+$/u, "");
  return (
    <header className="journal-intro">
      <div className="journal-intro-copy">
        <p className="journal-eyebrow" lang="en"><span /> A PERSONAL JOURNAL / ZHENG LI</p>
        <h1>
          {slogan}
          <span className="journal-intro-period">。</span>
        </h1>
        <p className="journal-intro-note" lang="en">A curious mind. An ongoing story.</p>
      </div>
      <JournalKeepsake initialScene={initialScene} />
      <div className="journal-index-line">
        <span lang="en">LATEST ENTRIES</span>
        <span>{total} 篇记录 <span aria-hidden="true">↙</span></span>
      </div>
    </header>
  );
}
