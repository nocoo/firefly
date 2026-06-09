import { describe, expect, it } from "vitest";
import { buildPageSlots } from "./pagination";

describe("buildPageSlots", () => {
  it("returns the full range when total ≤ 7", () => {
    expect(buildPageSlots(1, 1)).toEqual([1]);
    expect(buildPageSlots(3, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(buildPageSlots(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("ellipsis on the right when current is at the head", () => {
    expect(buildPageSlots(1, 20)).toEqual([1, 2, 3, 4, "...", 20]);
    expect(buildPageSlots(3, 20)).toEqual([1, 2, 3, 4, 5, "...", 20]);
  });

  it("ellipsis on both sides when current is in the middle", () => {
    expect(buildPageSlots(6, 20)).toEqual([1, "...", 4, 5, 6, 7, 8, "...", 20]);
    expect(buildPageSlots(10, 20)).toEqual([
      1,
      "...",
      8,
      9,
      10,
      11,
      12,
      "...",
      20,
    ]);
  });

  it("ellipsis on the left when current is at the tail", () => {
    expect(buildPageSlots(20, 20)).toEqual([1, "...", 17, 18, 19, 20]);
    expect(buildPageSlots(18, 20)).toEqual([1, "...", 16, 17, 18, 19, 20]);
  });

  it("clamps neighbor expansion to valid bounds", () => {
    // current near the head must not produce pages < 1
    expect(buildPageSlots(2, 20)).toEqual([1, 2, 3, 4, "...", 20]);
    // current near the tail must not produce pages > total
    expect(buildPageSlots(19, 20)).toEqual([1, "...", 17, 18, 19, 20]);
  });

  it("inserts ellipsis when slots have a gap > 1", () => {
    // current=4, total=8: slots are {1,2,3,4,5,6,8} → ellipsis between 6 and 8
    expect(buildPageSlots(4, 8)).toEqual([1, 2, 3, 4, 5, 6, "...", 8]);
  });
});
