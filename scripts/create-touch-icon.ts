import sharp from "sharp";

await sharp("public/journal-icon.svg").resize(180, 180)
  .flatten({ background: "#f0f0e9" }).png().toFile("public/apple-touch-icon.png");
console.info("Generated the Journal's 180px Apple touch icon.");
