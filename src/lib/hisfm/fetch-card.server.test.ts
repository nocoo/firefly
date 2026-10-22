import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockHisFmCardPayload } from "./fixtures";

vi.mock("server-only", () => ({}));

const cacheFn = vi.fn((fn: () => Promise<unknown>) => fn);

vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => Promise<unknown>) => cacheFn(fn),
}));

import {
  fetchHisFmCardForCache,
  HisFmCardCacheMissError,
  loadHisFmPodcastCard,
} from "./fetch-card.server";

const EPISODE =
  "https://his.fm/episodes/manager-notes/same-mindset-makes-expansion-pointless";

describe("fetchHisFmCardForCache", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null for HTTP 404 and not_found JSON", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });
    expect(await fetchHisFmCardForCache(EPISODE)).toBeNull();

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ v: 1, status: "not_found" }),
    });
    expect(await fetchHisFmCardForCache(EPISODE)).toBeNull();
  });

  it("throws on invalid JSON and timeout", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("bad json");
      },
    });
    await expect(fetchHisFmCardForCache(EPISODE)).rejects.toBeInstanceOf(
      HisFmCardCacheMissError,
    );

    fetchMock.mockRejectedValueOnce(new DOMException("Aborted", "AbortError"));
    await expect(fetchHisFmCardForCache(EPISODE)).rejects.toBeInstanceOf(
      HisFmCardCacheMissError,
    );
  });

  it("throws on 503 and invalid published payload", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });
    await expect(fetchHisFmCardForCache(EPISODE)).rejects.toBeInstanceOf(
      HisFmCardCacheMissError,
    );

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ v: 1, status: "published", title: "incomplete" }),
    });
    await expect(fetchHisFmCardForCache(EPISODE)).rejects.toBeInstanceOf(
      HisFmCardCacheMissError,
    );
  });

  it("returns card on success", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockHisFmCardPayload(),
    });
    const card = await fetchHisFmCardForCache(EPISODE);
    expect(card?.title).toBeTruthy();
  });
});

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

  it("returns null to the page when cache fetch throws", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    expect(await loadHisFmPodcastCard(EPISODE)).toBeNull();
  });

  it("returns null when fetch rejects redirects", async () => {
    fetchMock.mockRejectedValue(new TypeError("redirected"));
    expect(await loadHisFmPodcastCard(EPISODE)).toBeNull();
  });

  it("uses redirect error mode", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockHisFmCardPayload(),
    });
    await loadHisFmPodcastCard(EPISODE);
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
    const result = await loadHisFmPodcastCard(EPISODE);
    expect(result?.page_url).toContain("his.fm");
  });

  it("returns null when unstable_cache throws", async () => {
    cacheFn.mockImplementationOnce(
      () => () => Promise.reject(new Error("cache down")),
    );
    expect(await loadHisFmPodcastCard(EPISODE)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
