import { describe, it, expect } from "vitest";
import { z } from "zod";
import { mcpPodcastUrlSchema } from "./podcast-url-schema";

const schema = z.object({ podcast_url: mcpPodcastUrlSchema });

describe("mcpPodcastUrlSchema", () => {
  it("accepts valid episode URLs and null", () => {
    expect(
      schema.safeParse({
        podcast_url:
          "https://his.fm/episodes/manager-notes/what-the-reorg-did-not-write",
      }).success,
    ).toBe(true);
    expect(schema.safeParse({ podcast_url: null }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(true);
  });

  it("rejects invalid hosts", () => {
    const result = schema.safeParse({ podcast_url: "https://example.com/a/b" });
    expect(result.success).toBe(false);
  });
});
