/** Parse "2026-02" → { year: 2026, month: 2 } or "2024" → { year: 2024 } */
export function parseArchivePeriod(period: string): {
  year: number;
  month?: number;
} | null {
  const parts = period.split("-");
  if (parts.length > 2) return null;

  const year = parseInt(parts[0], 10);
  if (Number.isNaN(year) || year < 1970 || year > 9999) return null;

  if (parts.length === 2) {
    const month = parseInt(parts[1], 10);
    if (Number.isNaN(month) || month < 1 || month > 12) return null;
    return { year, month };
  }
  return { year };
}
