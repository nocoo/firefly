import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockHisFmCardPayload } from "./fixtures";

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => Promise<unknown>) => fn,
}));

import { loadHisFmPodcastCard } from "./fetch-card.server";

describe("loadHisFmPodcastCard", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when podcast url is empty", async () => {
    expect(await loadHisFmPodcastCard(null)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null on HTTP error", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });
    const result = await loadHisFmPodcastCard(
      "https://his.fm/episodes/manager-notes/what-the-reorg-did-not-write",
    );
    expect(result).toBeNull();
  });

  it("returns parsed card on success", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockHisFmCardPayload(),
    });
    const result = await loadHisFmPodcastCard(
      "https://his.fm/episodes/manager-notes/same-mindset-makes-expansion-pointless",
    );
    expect(result?.title).toContain("同一种心态");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("his.fm/api/card?url="),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("returns null when fetch aborts", async () => {
    fetchMock.mockRejectedValue(new DOMException("Aborted", "AbortError"));
    const result = await loadHisFmPodcastCard(
      "https://his.fm/episodes/manager-notes/same-mindset-makes-expansion-pointless",
    );
    expect(result).toBeNull();
  });
});
