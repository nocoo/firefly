/** Hex of `--blog-accent` for Safari `theme-color` (meta cannot take oklch). */
export const THEME_COLOR_LIGHT = "#1348dc";
export const THEME_COLOR_DARK = "#6f98f0";

export function themeColorFor(theme: string | undefined): string {
  return theme === "dark" ? THEME_COLOR_DARK : THEME_COLOR_LIGHT;
}

export function syncThemeColorMeta(color: string, doc: Document = document): void {
  const metas = doc.querySelectorAll('meta[name="theme-color"]');
  if (metas.length === 0) {
    const meta = doc.createElement("meta");
    meta.setAttribute("name", "theme-color");
    meta.setAttribute("content", color);
    doc.head.appendChild(meta);
    return;
  }
  for (const meta of metas) {
    meta.setAttribute("content", color);
  }
}
