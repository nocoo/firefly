import { describe, it, expect } from "vitest";
import { parseArchivePeriod } from "./parse-archive-period";

describe("parseArchivePeriod", () => {
  it("parses year-only period", () => {
    expect(parseArchivePeriod("2026")).toEqual({ year: 2026 });
  });

  it("parses year-month period", () => {
    expect(parseArchivePeriod("2026-02")).toEqual({ year: 2026, month: 2 });
  });

  it("parses boundary months (1 and 12)", () => {
    expect(parseArchivePeriod("2024-01")).toEqual({ year: 2024, month: 1 });
    expect(parseArchivePeriod("2024-12")).toEqual({ year: 2024, month: 12 });
  });

  it("rejects invalid month (0)", () => {
    expect(parseArchivePeriod("2026-00")).toBeNull();
  });

  it("rejects invalid month (13)", () => {
    expect(parseArchivePeriod("2026-13")).toBeNull();
  });

  it("rejects out-of-range month (99)", () => {
    expect(parseArchivePeriod("2026-99")).toBeNull();
  });

  it("rejects non-numeric month", () => {
    expect(parseArchivePeriod("2026-foo")).toBeNull();
  });

  it("rejects non-numeric year", () => {
    expect(parseArchivePeriod("abc")).toBeNull();
  });

  it("rejects empty string", () => {
    expect(parseArchivePeriod("")).toBeNull();
  });

  it("rejects year below 1970", () => {
    expect(parseArchivePeriod("1969")).toBeNull();
  });

  it("rejects too many segments", () => {
    expect(parseArchivePeriod("2026-02-15")).toBeNull();
  });

  it("accepts year at lower bound (1970)", () => {
    expect(parseArchivePeriod("1970")).toEqual({ year: 1970 });
  });
});
