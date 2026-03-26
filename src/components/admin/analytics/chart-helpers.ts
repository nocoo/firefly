// ---------------------------------------------------------------------------
// Shared chart helpers and constants for analytics dashboard
// Follows pew project visual language: hidden axis/tick lines, subtle grid,
// custom tooltip components, gradient fills, --chart-axis/--chart-muted tokens.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Source type
// ---------------------------------------------------------------------------

export type SourceType = "human" | "search" | "ai" | "other";

export const SOURCE_TYPES: SourceType[] = ["human", "search", "ai", "other"];

// ---------------------------------------------------------------------------
// Palette — CSS custom property helpers (pew palette.ts pattern)
// ---------------------------------------------------------------------------

/** Wraps a CSS custom property name for inline style usage */
const v = (token: string) => `hsl(var(--${token}))`;

/**
 * Returns a CSS color string with alpha from a CSS custom property.
 * Usage: `withAlpha("chart-1", 0.3)` → `"hsl(var(--chart-1) / 0.3)"`
 */
export const withAlpha = (token: string, alpha: number) =>
  `hsl(var(--${token}) / ${alpha})`;

// ---------------------------------------------------------------------------
// Colors — use CSS custom properties for dark/light mode support
// ---------------------------------------------------------------------------

/** Semantic: neutral gray for axis text, grid lines, tick labels */
export const chartAxis = v("chart-axis");

/** Semantic: muted/weakened elements */
export const chartMuted = v("chart-muted");

export const SOURCE_COLORS: Record<SourceType, string> = {
  human: v("chart-1"),
  search: v("chart-2"),
  ai: v("chart-5"),
  other: v("chart-4"),
};

/** CSS variable tokens (without --) matching SOURCE_COLORS — for withAlpha() */
export const SOURCE_TOKENS: Record<SourceType, string> = {
  human: "chart-1",
  search: "chart-2",
  ai: "chart-5",
  other: "chart-4",
};

export const CHART_COLORS = [
  v("chart-1"),
  v("chart-2"),
  v("chart-3"),
  v("chart-4"),
  v("chart-5"),
  v("chart-6"),
  v("chart-7"),
  v("chart-8"),
];

/** CSS variable tokens (without --) matching CHART_COLORS — for withAlpha() */
export const CHART_TOKENS = Array.from(
  { length: 8 },
  (_, i) => `chart-${i + 1}`,
) as readonly string[];

export const PIE_COLORS = [
  v("chart-1"),
  v("chart-2"),
  v("chart-3"),
  v("chart-4"),
  v("chart-5"),
];

// ---------------------------------------------------------------------------
// Chart layout constants
// ---------------------------------------------------------------------------

/** Standard chart margin (pew convention) */
export const CHART_MARGIN = { top: 4, right: 4, left: 0, bottom: 0 };

/** Standard horizontal bar chart margin */
export const H_BAR_MARGIN = { top: 0, right: 4, left: 0, bottom: 0 };

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

/** Format date string "YYYY-MM-DD" → "Mar 25" for chart X-axis (pew convention) */
export function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Format a large number with locale separators */
export function formatNumber(n: number): string {
  return n.toLocaleString();
}

/** Format a delta percentage for display: "+25%", "-10%", "+42" (when new), or "—" for null */
export function formatDelta(
  delta: number | "new" | null,
  absoluteValue?: number,
): {
  text: string;
  positive: boolean | null;
} {
  if (delta === "new") {
    if (absoluteValue !== undefined) {
      return { text: `+${formatNumber(absoluteValue)}`, positive: true };
    }
    return { text: "NEW", positive: true };
  }
  if (delta === null) return { text: "—", positive: null };
  const sign = delta >= 0 ? "+" : "";
  return { text: `${sign}${delta}%`, positive: delta >= 0 };
}

/** Format referrer URL to just hostname */
export function formatReferrer(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace("www.", "");
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------------
// Period options
// ---------------------------------------------------------------------------

export const PERIOD_OPTIONS = [
  { value: 7, label: "7d" },
  { value: 30, label: "30d" },
  { value: 90, label: "90d" },
] as const;
