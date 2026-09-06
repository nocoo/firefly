import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { chromium } from "@playwright/test";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import social from "../src/lib/home-social.json";

// Run from the repository root. Font refresh sends only the public card copy.
if (process.argv.includes("--refresh-font")) {
  const characters = [...new Set(`${social.heading}${social.topics}${social.note}`)]
    .sort().join("");
  const url = new URL("https://fonts.googleapis.com/css2");
  url.searchParams.set("family", "Noto Sans SC:wght@400..700");
  url.searchParams.set("text", characters);
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Font metadata: ${response.status}`);
  const source = /src:\s*url\(([^)]+)\)/.exec(await response.text())?.[1];
  if (!source || new URL(source).hostname !== "fonts.gstatic.com") {
    throw new Error("Unrecognized font source");
  }
  const font = await fetch(source, { signal: AbortSignal.timeout(20_000) });
  if (!font.ok) throw new Error(`Font download: ${font.status}`);
  const data = Buffer.from(await font.arrayBuffer());
  if (data.subarray(0, 4).toString() !== "wOF2") throw new Error("Expected WOFF2");
  const license = await fetch("https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/LICENSE", {
    signal: AbortSignal.timeout(20_000),
  });
  if (!license.ok) throw new Error(`Font license: ${license.status}`);
  const licenseText = await license.text();
  if (!licenseText.includes("SIL OPEN FONT LICENSE")) throw new Error("Expected OFL");
  await writeFile("assets/social/journal-cjk.woff2", data);
  await writeFile("assets/social/OFL.txt", licenseText);
  await writeFile("assets/social/characters.txt", `${characters}\n`);
}

const dataUrl = async (path: string, type: string) =>
  `data:${type};base64,${(await readFile(path)).toString("base64")}`;
const cssPath = "scripts/social.css";
let css = await readFile(cssPath, "utf8");
for (const match of css.matchAll(/url\("([^"]+)"\)/g)) {
  const path = resolve(dirname(cssPath), match[1] as string);
  css = css.replace(match[0], `url("${await dataUrl(path, "font/woff2")}")`);
}
const illustration = await dataUrl("assets/social/journal.svg", "image/svg+xml");
const markup = renderToStaticMarkup(
  <main className="social-card">
    <header>
      <div className="brand">
        <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
        <span>zheng li<span className="brand-period">.</span></span>
      </div>
      <span className="label">A PERSONAL JOURNAL</span>
    </header>
    <div className="copy">
      <h1>{social.heading}</h1>
      <p className="topics">{social.topics}</p>
      <p className="note">{social.note}</p>
    </div>
    <img className="illustration" src={illustration} alt="" />
    <footer>
      <span>ENGINEERING · AI · TEAM LEADERSHIP</span>
      <strong>lizheng.blog</strong>
    </footer>
  </main>,
);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
  await page.route("**/*", (route) => route.abort());
  await page.setContent(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>${css}</style></head><body>${markup}</body></html>`);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => image.decode()));
  });
  const buffer = await sharp(await page.screenshot())
    .resize(1200, 630)
    .jpeg({ quality: 90, chromaSubsampling: "4:4:4", mozjpeg: true })
    .toBuffer();
  if (buffer.length > 500 * 1024) throw new Error("Social image exceeds 500 KiB");
  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 12);
  const filename = `journal-zh.${hash}.jpg`;
  await mkdir("public/social", { recursive: true });
  await writeFile(`public/social/${filename}`, buffer);
  social.image.url = `/social/${filename}`;
  await writeFile("src/lib/home-social.json", `${JSON.stringify(social, null, 2)}\n`);
  console.info(`${filename}: 1200×630, ${buffer.length} bytes`);
} finally {
  await browser.close();
}
