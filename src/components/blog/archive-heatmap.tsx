import Link from "next/link";
import type { MonthlyArchive } from "@/data/entities/post-types";

interface ArchiveHeatmapProps {
  /** All months with published posts, year-DESC. The heatmap renders only
   *  rows for years that actually have posts (skipping empty calendar years). */
  archives: readonly MonthlyArchive[];
  /** Optional filter to a single year — used on /archive/{year} pages. */
  year?: number;
}

/**
 * Compact monthly post-count heatmap, one row per year × 12 columns.
 *
 * Style is intentionally non-graph-y: aligned squares with intensity scaled
 * to the busiest month in view. Each cell links to the month's archive page.
 * Empty months render as a faint placeholder so the grid stays uniform.
 *
 * Renders nothing if no archive data is available — caller doesn't need to
 * guard.
 */
export function ArchiveHeatmap({ archives, year }: ArchiveHeatmapProps) {
  const filtered = year ? archives.filter((a) => a.year === year) : archives;
  if (filtered.length === 0) return null;

  const maxCount = filtered.reduce((m, a) => Math.max(m, a.count), 0);
  if (maxCount === 0) return null;

  // Group by year so each row renders independently.
  const byYear = new Map<number, Map<number, number>>();
  for (const a of filtered) {
    const months = byYear.get(a.year) ?? new Map<number, number>();
    months.set(a.month, a.count);
    byYear.set(a.year, months);
  }
  const years = Array.from(byYear.keys()).sort((a, b) => b - a);

  return (
    <div
      className="archive-heatmap"
      role="figure"
      aria-label="文章发布频次"
    >
      {years.map((y) => {
        const months = byYear.get(y) ?? new Map<number, number>();
        return (
          <div key={y} className="archive-heatmap-row">
            <Link
              href={`/archive/${y}`}
              className="archive-heatmap-year"
            >
              {y}
            </Link>
            <div className="archive-heatmap-cells">
              {Array.from({ length: 12 }, (_, i) => {
                const m = i + 1;
                const count = months.get(m) ?? 0;
                const ratio = count / maxCount;
                const period = `${y}-${String(m).padStart(2, "0")}`;
                const label = `${y} 年 ${m} 月，${count} 篇`;
                if (count === 0) {
                  return (
                    <span
                      key={m}
                      className="archive-heatmap-cell archive-heatmap-cell-empty"
                      title={label}
                      aria-label={label}
                    />
                  );
                }
                return (
                  <Link
                    key={m}
                    href={`/archive/${period}`}
                    className="archive-heatmap-cell"
                    style={
                      {
                        "--cell-intensity": ratio.toFixed(2),
                      } as React.CSSProperties
                    }
                    title={label}
                    aria-label={label}
                  >
                    <span className="sr-only">
                      {y} 年 {m} 月：{count}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
