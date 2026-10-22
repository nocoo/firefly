import { describe, it, expect } from "vitest";
import { parseHisFmCardPayload } from "./card-schema";
import { mockHisFmCardPayload } from "./fixtures";

describe("parseHisFmCardPayload", () => {
  it("parses a published v1 card", () => {
    const card = parseHisFmCardPayload(mockHisFmCardPayload());
    expect(card).not.toBeNull();
    expect(card?.title).toContain("同一种心态");
    expect(card?.audio.url).toContain("f.no.mt");
  });

  it("returns null for not_found or incomplete payloads", () => {
    expect(
      parseHisFmCardPayload(mockHisFmCardPayload({ status: "not_found" })),
    ).toBeNull();
    expect(
      parseHisFmCardPayload(mockHisFmCardPayload({ audio: undefined })),
    ).toBeNull();
    expect(parseHisFmCardPayload({ v: 2, status: "published" })).toBeNull();
  });
});
