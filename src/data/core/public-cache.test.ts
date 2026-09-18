import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => { vi.resetModules(); });

vi.mock("next/cache", () => ({
  unstable_cache: vi.fn((load: () => Promise<unknown>) => load),
  revalidateTag: vi.fn(),
}));

import { revalidateTag, unstable_cache } from "next/cache";
import { invalidatePublicContent, readPublicContent } from "./public-cache";

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.mocked(revalidateTag).mockReset();
  invalidatePublicContent();
  vi.clearAllMocks();
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("public content cache coordination", () => {
  it("coalesces concurrent loads and assigns the native cache tag and lifetime", async () => {
    const completion = deferred<string>();
    const load = vi.fn(() => completion.promise);
    const first = readPublicContent(["post", "a"], load);
    const second = readPublicContent(["post", "a"], load);
    expect(first).toBe(second);
    expect(load).toHaveBeenCalledOnce();
    completion.resolve("article");
    await expect(first).resolves.toBe("article");
    expect(unstable_cache).toHaveBeenCalledWith(expect.any(Function), expect.any(Array), {
      tags: ["public-content"], revalidate: 3600,
    });
  });

  it("isolates a late pre-write result from the new generation", async () => {
    const old = deferred<string>();
    const first = readPublicContent(["post", "a"], () => old.promise);
    const oldKey = vi.mocked(unstable_cache).mock.calls[0][1];
    invalidatePublicContent();
    await expect(readPublicContent(["post", "a"], async () => "new")).resolves.toBe("new");
    expect(vi.mocked(unstable_cache).mock.calls[1][1]).not.toEqual(oldKey);
    expect(revalidateTag).toHaveBeenCalledWith("public-content", { expire: 0 });
    old.resolve("old");
    await expect(first).resolves.toBe("old");
  });

  it("does not let a late negative result hide a newly published post", async () => {
    const old = deferred<null>();
    const first = readPublicContent(["post", "a"], () => old.promise);
    invalidatePublicContent();
    old.resolve(null);
    await expect(first).resolves.toBeNull();
    await expect(readPublicContent(["post", "a"], async () => "published")).resolves.toBe("published");
  });

  it("bounds and expires negative entries without persisting scanner URLs", async () => {
    vi.useFakeTimers();
    const load = vi.fn(async () => null);
    await readPublicContent(["missing", 0], load);
    await readPublicContent(["missing", 0], load);
    expect(load).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(30_000);
    await readPublicContent(["missing", 0], load);
    expect(load).toHaveBeenCalledTimes(2);
    for (let i = 1; i <= 256; i++) await readPublicContent(["missing", i], load);
    await readPublicContent(["missing", 0], load);
    expect(load).toHaveBeenCalledTimes(259);
    invalidatePublicContent();
    await expect(readPublicContent(["missing", 0], async () => "now exists")).resolves.toBe("now exists");
  });

  it("does not retain database failures", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("D1 unavailable")).mockResolvedValueOnce("ok");
    await expect(readPublicContent(["post", "a"], load)).rejects.toThrow("D1 unavailable");
    await expect(readPublicContent(["post", "a"], load)).resolves.toBe("ok");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("caps cache key growth and still serves uncached requests", async () => {
    for (let i = 0; i < 2048; i++) await readPublicContent(["list", i], async () => i);
    const calls = vi.mocked(unstable_cache).mock.calls.length;
    await expect(readPublicContent(["list", 2048], async () => 2048)).resolves.toBe(2048);
    expect(unstable_cache).toHaveBeenCalledTimes(calls);
    await readPublicContent(["list", 0], async () => 0);
    expect(unstable_cache).toHaveBeenCalledTimes(calls + 1);
  });

  it("keeps committed writes successful if framework invalidation fails", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(revalidateTag).mockImplementationOnce(() => { throw new Error("no request context"); });
    expect(invalidatePublicContent).not.toThrow();
    expect(log).toHaveBeenCalledOnce();
  });
});
