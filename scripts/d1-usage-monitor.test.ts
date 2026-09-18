import { describe, expect, it } from "vitest";
import { completePostDays, halfHours } from "./d1-usage-monitor";

describe("D1 monitor accounting", () => {
  const sum = { readQueries: 1, writeQueries: 2, rowsRead: 10, rowsWritten: 20 };
  it("combines quarter-hours without inventing data for missing intervals", () => {
    const result = halfHours([
      { dimensions: { datetimeFifteenMinutes: "2026-09-17T23:15:00Z" }, sum },
      { dimensions: { datetimeFifteenMinutes: "2026-09-17T23:00:00Z" }, sum },
      { dimensions: { datetimeFifteenMinutes: "2026-09-18T00:00:00Z" }, sum },
    ]);
    expect(result).toEqual([
      { start: "2026-09-17T23:00:00.000Z", readQueries: 2, writeQueries: 4, rowsRead: 20, rowsWritten: 40 },
      { start: "2026-09-18T00:00:00.000Z", ...sum },
    ]);
  });
  it("excludes the rollout day and incomplete current UTC day", () => {
    const days = ["2026-09-17", "2026-09-18", "2026-09-19"].map((date) => ({ dimensions: { date }, sum }));
    expect(completePostDays(days, "2026-09-17T12:00:00Z", "2026-09-19")).toEqual([days[1]]);
    expect(completePostDays(days, undefined, "2026-09-19")).toEqual([]);
  });
});
