/** Validate and pick his.fm theme colors for the blog card (WCAG-aware). */

const HEX_RE = /^#([0-9A-Fa-f]{6})$/;

export function parseHexColor(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!HEX_RE.test(trimmed)) return null;
  return trimmed.toUpperCase();
}

function channel(hex: string, index: number): number {
  const slice = hex.slice(1 + index * 2, 1 + index * 2 + 2);
  const linear = Number.parseInt(slice, 16) / 255;
  return linear <= 0.03928
    ? linear / 12.92
    : ((linear + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const r = channel(hex, 0);
  const g = channel(hex, 1);
  const b = channel(hex, 2);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Minimum 3:1 for UI components (WCAG AA non-text). */
export function accentUsableOnBackground(
  accent: string,
  background: string,
  minRatio = 3,
): boolean {
  return contrastRatio(accent, background) >= minRatio;
}

export function pickReadableOnAccent(accent: string): string {
  const white = "#FFFFFF";
  const black = "#000000";
  return contrastRatio(white, accent) >= contrastRatio(black, accent)
    ? white
    : black;
}

/** Blog journal surfaces (see journal.css). */
export const JOURNAL_SURFACE_LIGHT = "#F7F7F0";
export const JOURNAL_SURFACE_DARK = "#1E2824";

export function resolveCardAccent(
  theme: { accent?: string | undefined; ink?: string | undefined },
  isDark: boolean,
): string | null {
  const surface = isDark ? JOURNAL_SURFACE_DARK : JOURNAL_SURFACE_LIGHT;
  const accent = parseHexColor(theme.accent);
  if (accent && accentUsableOnBackground(accent, surface)) return accent;
  const ink = parseHexColor(theme.ink);
  if (ink && accentUsableOnBackground(ink, surface, 4.5)) return ink;
  return null;
}

export function resolveCardTint(
  paper: string | undefined,
  isDark: boolean,
): string | null {
  const parsed = parseHexColor(paper);
  if (!parsed) return null;
  const surface = isDark ? JOURNAL_SURFACE_DARK : JOURNAL_SURFACE_LIGHT;
  if (!accentUsableOnBackground(parsed, surface, 1.5)) return null;
  return parsed;
}
