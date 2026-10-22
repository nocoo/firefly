import { describe, it, expect } from "vitest";
import {
  assertValidPodcastUrlInput,
  PostFieldValidationError,
} from "./post-field-validation";

describe("assertValidPodcastUrlInput", () => {
  it("allows null and undefined", () => {
    expect(() => assertValidPodcastUrlInput(undefined)).not.toThrow();
    expect(() => assertValidPodcastUrlInput(null)).not.toThrow();
  });

  it("throws for invalid URLs", () => {
    expect(() => assertValidPodcastUrlInput("https://example.com/a/b")).toThrow(
      PostFieldValidationError,
    );
  });

  it("accepts his.fm episode URLs", () => {
    expect(() =>
      assertValidPodcastUrlInput(
        "https://his.fm/episodes/manager-notes/same-mindset-makes-expansion-pointless",
      ),
    ).not.toThrow();
  });
});
