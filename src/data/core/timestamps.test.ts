import { describe, it, expect } from "vitest";
import { nowEpoch, newId } from "./timestamps";

// ---------------------------------------------------------------------------
// nowEpoch
// ---------------------------------------------------------------------------

describe("nowEpoch", () => {
  it("returns current time as unix epoch seconds", () => {
    const before = Math.floor(Date.now() / 1000);
    const result = nowEpoch();
    const after = Math.floor(Date.now() / 1000);
    expect(result).toBeGreaterThanOrEqual(before);
    expect(result).toBeLessThanOrEqual(after);
  });

  it("returns integer (no fractional seconds)", () => {
    const result = nowEpoch();
    expect(Number.isInteger(result)).toBe(true);
  });

  it("returns a positive number", () => {
    const result = nowEpoch();
    expect(result).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// newId
// ---------------------------------------------------------------------------

describe("newId", () => {
  it("returns a non-empty string", () => {
    const id = newId();
    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
  });

  it("returns unique ids on successive calls", () => {
    const id1 = newId();
    const id2 = newId();
    expect(id1).not.toBe(id2);
  });

  it("returns a ULID (26 chars, Crockford Base32)", () => {
    const id = newId();
    expect(id).toHaveLength(26);
    expect(id).toMatch(/^[0-9A-Z]+$/);
  });

  it("ids are time-sortable (first id < second id)", async () => {
    // ULIDs are time-sortable; wait briefly to ensure different timestamps
    const id1 = newId();
    await new Promise((r) => setTimeout(r, 2));
    const id2 = newId();
    expect(id1 < id2).toBe(true);
  });
});
