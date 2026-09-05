export function JournalIntro({ siteName, tagline, total }: { siteName: string; tagline: string; total: number }) {
  const lines = (tagline || siteName).replace("，", "，\n").split("\n");
  return (
    <header className="journal-intro">
      <div className="journal-intro-copy">
        <p className="journal-eyebrow" lang="en"><span /> A PERSONAL JOURNAL / ZHENG LI</p>
        <h1>{lines.map((line) => <span key={line}>{line}</span>)}</h1>
        <p className="journal-intro-note" lang="en">A curious mind. An ongoing story.</p>
      </div>
      <div className="journal-cartridge" aria-hidden="true">
        <svg viewBox="0 0 180 204" fill="none" focusable="false" aria-hidden="true">
          <defs>
            <linearGradient id="journal-shell" x1="25" y1="10" x2="157" y2="180" gradientUnits="userSpaceOnUse">
              <stop stopColor="#eeeee0" /><stop offset="1" stopColor="#bfc7b2" />
            </linearGradient>
            <linearGradient id="journal-label" x2="0" y2="1">
              <stop stopColor="#d3dbb9" /><stop offset="1" stopColor="#afbf8a" />
            </linearGradient>
          </defs>
          <path d="M24 27h127l5 11v139l-15 16H27l-9-10V39Z" fill="#8c9980" />
          <path d="M26 19h119l7 12v139l-16 17H24l-9-10V31Z" fill="url(#journal-shell)" stroke="#f9fbe9" />
          <path d="M30 33h108M30 39h108M30 45h108" stroke="#8b987a" strokeOpacity=".4" />
          <path d="M28 55h111v94H28Z" fill="#6f7e60" />
          <path d="M30 57h107v89H30Z" fill="url(#journal-label)" stroke="#f4f5d5" />
          <path d="M58 79h22v4h7v-4h22v41H88v5h-8v-5H58Z" fill="#526348" />
          <path d="M62 83h15v4h4v28h-4v-3H62Zm43 0H90v4h-4v28h4v-3h15Z" fill="#d5dfb9" />
          <path d="M66 89h8v3h-8Zm0 7h8v3h-8Zm26-7h8v3h-8Zm0 7h8v3h-8Z" fill="#9caf7b" />
          <path d="M43 159h21m-21 5h21m38-5h21m-21 5h21" stroke="#859279" />
          <path d="m77 167 6 5 6-5" stroke="#89967e" strokeWidth="2" />
        </svg>
        <span className="journal-cartridge-label" lang="en">FIELD NOTES</span>
        <span className="journal-pixel-spark journal-spark-one" />
        <span className="journal-pixel-spark journal-spark-two" />
      </div>
      <div className="journal-index-line">
        <span lang="en">LATEST ENTRIES</span>
        <span>{total} 篇记录 <span aria-hidden="true">↙</span></span>
      </div>
    </header>
  );
}
