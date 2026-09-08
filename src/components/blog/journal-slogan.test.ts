import { describe, expect, it } from "vitest";
import { splitJournalSlogan } from "./journal-slogan";

describe("splitJournalSlogan", () => {
  it("splits on the first Chinese comma and keeps the rest", () => {
    expect(splitJournalSlogan("知白守黑，方能处世", "站点")).toEqual({
      first: "知白守黑",
      punct: "，",
      rest: "方能处世",
    });
  });

  it("splits on the first English comma", () => {
    expect(splitJournalSlogan("Hello, world", "Site")).toEqual({
      first: "Hello",
      punct: ",",
      rest: "world",
    });
  });

  it("does not split when punctuation is only at the end", () => {
    expect(splitJournalSlogan("知白守黑。", "站点")).toEqual({
      first: "知白守黑",
      punct: null,
      rest: null,
    });
  });

  it("falls back to the site name when the tagline is empty", () => {
    expect(splitJournalSlogan("  ", "李征")).toEqual({
      first: "李征",
      punct: null,
      rest: null,
    });
  });
});
