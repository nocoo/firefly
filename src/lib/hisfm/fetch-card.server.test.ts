import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockHisFmCardPayload } from "./fixtures";

vi.mock("server-only", () => ({}));

const cacheFn = vi.fn((fn: () => Promise<unknown>) => fn);

vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => Promise<unknown>) => cacheFn(fn),
}));

import { loadHisFmPodcastCard } from "./fetch-card.server";

describe("loadHisFmPodcastCard", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    cacheFn.mockImplementation((fn: () => Promise<unknown>) => fn);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when podcast url is empty", async () => {
    expect(await loadHisFmPodcastCard(null)).toBeNull();
    expect(await loadHisFmPodcastCard("   ")).toBeNull();
    expect(await loadHisFmPodcastCard(42 as unknown as string)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null for malformed stored podcast_url", async () => {
    expect(await loadHisFmPodcastCard("https://example.com/x")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null when response json fails schema", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ v: 1, status: "published", title: "no audio" }),
    });
    expect(
      await loadHisFmPodcastCard(
        "https://his.fm/episodes/manager-notes/same-mindset-makes-expansion-pointless",
      ),
    ).toBeNull();
  });

  it("returns null on HTTP error", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });
    const result = await loadHisFmPodcastCard(
      "https://his.fm/episodes/manager-notes/what-the-reorg-did-not-write",
    );
    expect(result).toBeNull();
  });

  it("returns null when fetch rejects redirects", async () => {
    fetchMock.mockRejectedValue(new TypeError("redirected"));
    const result = await loadHisFmPodcastCard(
      "https://his.fm/episodes/manager-notes/same-mindset-makes-expansion-pointless",
    );
    expect(result).toBeNull();
  });

  it("uses redirect error mode", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockHisFmCardPayload(),
    });
    await loadHisFmPodcastCard(
      "https://his.fm/episodes/manager-notes/same-mindset-makes-expansion-pointless",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("his.fm/api/card?url="),
      expect.objectContaining({ redirect: "error" }),
    );
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
    expect(result?.title).toBeTruthy();
    expect(result?.page_url).toContain("his.fm");
  });

  it("returns null when fetch aborts", async () => {
    fetchMock.mockRejectedValue(new DOMException("Aborted", "AbortError"));
    const result = await loadHisFmPodcastCard(
      "https://his.fm/episodes/manager-notes/same-mindset-makes-expansion-pointless",
    );
    expect(result).toBeNull();
  });

  it("returns null when unstable_cache throws", async () => {
    cacheFn.mockImplementationOnce(
      () => () => Promise.reject(new Error("cache down")),
    );
    const result = await loadHisFmPodcastCard(
      "https://his.fm/episodes/manager-notes/same-mindset-makes-expansion-pointless",
    );
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
