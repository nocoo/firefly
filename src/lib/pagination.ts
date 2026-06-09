/**
 * Build a list of page slots with ellipses for pagination UIs.
 *
 * Always includes first page, last page, and pages around current (±2).
 * Ensures at least 4 consecutive pages at the edges so the head/tail
 * runs read as a continuous range rather than “1 … 4”.
 *
 * Examples (current=1, total=20): [1, 2, 3, 4, "...", 20]
 *          (current=6, total=20): [1, "...", 4, 5, 6, 7, 8, "...", 20]
 *          (current=1, total=5):  [1, 2, 3, 4, 5]
 */
export function buildPageSlots(
  current: number,
  total: number,
): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const slots = new Set<number>();
  slots.add(1);
  slots.add(total);
  for (let i = current - 2; i <= current + 2; i++) {
    if (i >= 1 && i <= total) slots.add(i);
  }
  if (current <= 3) {
    for (let i = 1; i <= Math.min(4, total); i++) slots.add(i);
  }
  if (current >= total - 2) {
    for (let i = Math.max(1, total - 3); i <= total; i++) slots.add(i);
  }

  const sorted = [...slots].sort((a, b) => a - b);
  const result: (number | "...")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push("...");
    result.push(sorted[i]);
  }
  return result;
}
