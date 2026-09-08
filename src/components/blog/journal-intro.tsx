import { connection } from "next/server";
import { randomKeepsake } from "@/lib/journal-keepsake";
import { JournalKeepsake } from "./journal-keepsake";
import { splitJournalSlogan } from "./journal-slogan";

export async function JournalIntro({ siteName, tagline, total }: { siteName: string; tagline: string; total: number }) {
  await connection();
  const initialScene = randomKeepsake();
  const { first, punct, rest } = splitJournalSlogan(tagline, siteName);
  return (
    <header className="journal-intro">
      <div className="journal-intro-copy">
        <p className="journal-eyebrow" lang="en"><span /> A PERSONAL JOURNAL / ZHENG LI</p>
        <h1>
          <span>
            {first}
            {punct ? <span className="journal-intro-period">{punct}</span> : null}
            {rest ? null : <span className="journal-intro-period">。</span>}
          </span>
          {rest ? (
            <span className="journal-intro-rest">
              {rest}
              <span className="journal-intro-period">。</span>
            </span>
          ) : null}
        </h1>
        <p className="journal-intro-note" lang="en">A curious mind. An ongoing story.</p>
      </div>
      <JournalKeepsake initialScene={initialScene} />
      <div className="journal-index-line">
        <span lang="en">LATEST ARTICLES</span>
        <span>{total} 篇文章 <span aria-hidden="true">↙</span></span>
      </div>
    </header>
  );
}
