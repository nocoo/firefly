import { afterEach, expect, it, vi } from "vitest";
import { documentKeepsake, keepsakeIds, randomKeepsake } from "./journal-keepsake";

const freshDocument = () => ({ documentElement: { dataset: {} } }) as Document;
afterEach(() => vi.restoreAllMocks());

it("chooses all six device families across new documents", () => {
  const random = vi.spyOn(Math, "random");
  for (const [index, id] of keepsakeIds.entries()) {
    random.mockReturnValue((index + .5) / keepsakeIds.length);
    expect(randomKeepsake()).toBe(id);
  }
  expect(new Set(keepsakeIds).size).toBe(6);
});

it("keeps the choice during navigation, remounts and theme changes", () => {
  const doc = freshDocument();
  expect(documentKeepsake(doc, "garmin")).toBe("garmin");
  expect(documentKeepsake(doc, "gameboy")).toBe("garmin");
  expect(documentKeepsake(doc, "honda")).toBe("garmin");
  expect(documentKeepsake(freshDocument(), "honda")).toBe("honda");
});

it("replaces invalid document choices before resolving an image URL", () => {
  const doc = freshDocument();
  doc.documentElement.dataset.keepsake = "../../bad";
  expect(documentKeepsake(doc, "ipod")).toBe("ipod");
});

it("keeps the server's first-frame choice during hydration without drawing again", () => {
  const random = vi.spyOn(Math, "random").mockReturnValue(0);
  for (const id of keepsakeIds) {
    const doc = freshDocument();
    expect(documentKeepsake(doc, id)).toBe(id);
    expect(doc.documentElement.dataset.keepsake).toBe(id);
  }
  expect(random).not.toHaveBeenCalled();
});
