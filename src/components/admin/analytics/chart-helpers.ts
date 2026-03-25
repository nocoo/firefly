// ---------------------------------------------------------------------------
// Shared chart helpers and constants for analytics dashboard
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Source type
// ---------------------------------------------------------------------------

export type SourceType = "human" | "search" | "ai" | "other";

export const SOURCE_TYPES: SourceType[] = ["human", "search", "ai", "other"];

// ---------------------------------------------------------------------------
// Colors — use CSS custom properties for dark/light mode support
// ---------------------------------------------------------------------------

export const SOURCE_COLORS: Record<SourceType, string> = {
  human: "hsl(var(--chart-1))",
  search: "hsl(var(--chart-2))",
  ai: "hsl(var(--chart-5))",
  other: "hsl(var(--chart-4))",
};

export const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-6))",
  "hsl(var(--chart-7))",
  "hsl(var(--chart-8))",
];

export const PIE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

// ---------------------------------------------------------------------------
// Shared tooltip style
// ---------------------------------------------------------------------------

export const TOOLTIP_STYLE: React.CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "8px",
  fontSize: "12px",
};

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

/** Format date string "YYYY-MM-DD" → "MM-DD" for chart X-axis */
export function formatDateShort(date: string): string {
  return date.slice(5); // "03-25"
}

/** Format a large number with locale separators */
export function formatNumber(n: number): string {
  return n.toLocaleString();
}

/** Format a delta percentage for display: "+25%", "-10%", or "—" for null */
export function formatDelta(delta: number | null): {
  text: string;
  positive: boolean | null;
} {
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
