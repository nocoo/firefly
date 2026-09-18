import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockDb, createMockPostWithAgent } from "./core/test-utils";
import { invalidatePublicContent } from "./core/public-cache";

// The suite shares workers with route tests that import this facade using
// different entity mocks. Load it against this suite's own dependencies.
vi.hoisted(() => { vi.resetModules(); });

vi.mock("./entities/post", () => ({
  listPosts: vi.fn(), getPostBySlug: vi.fn(), getPostTags: vi.fn(),
  getAdjacentPosts: vi.fn(), listMonthlyArchives: vi.fn(),
}));
vi.mock("./entities/category", () => ({ listCategories: vi.fn() }));
vi.mock("./entities/tag", () => ({ listTags: vi.fn() }));
vi.mock("./entities/human", () => ({ getDefaultHuman: vi.fn() }));
vi.mock("./entities/comment", () => ({ listCommentsByPost: vi.fn() }));
vi.mock("./settings", () => ({ getSiteSettings: vi.fn() }));

import * as rawPosts from "./entities/post";
import * as rawCategories from "./entities/category";
import * as rawTags from "./entities/tag";
import * as rawHumans from "./entities/human";
import * as rawComments from "./entities/comment";
import * as rawSettings from "./settings";
import * as content from "./public-content";

beforeEach(() => { invalidatePublicContent(); vi.resetAllMocks(); });

describe("public content reads", () => {
  it("forces published status and normalizes paging without an inner count cache", async () => {
    const db = createMockDb();
    const result = { posts: [createMockPostWithAgent()], total: 1 };
    vi.mocked(rawPosts.listPosts).mockResolvedValue(result);
    expect(await content.listPosts(db, { status: "private", page: -1, pageSize: 999 })).toBe(result);
    expect(rawPosts.listPosts).toHaveBeenCalledWith(db, expect.objectContaining({
      status: "published", page: 1, pageSize: 100, sortBy: "published_at", sortOrder: "desc",
    }), false);
    await content.listPosts(db);
    expect(rawPosts.listPosts).toHaveBeenLastCalledWith(db, expect.objectContaining({ page: 1, pageSize: 20 }), false);
    await content.listPosts(db, { page: 2, pageSize: 5.5, categoryId: "category", tagId: "tag", archiveYear: 2026, archiveMonth: 9 });
    expect(rawPosts.listPosts).toHaveBeenLastCalledWith(db, expect.objectContaining({
      page: 2, pageSize: 5, categoryId: "category", tagId: "tag", archiveYear: 2026, archiveMonth: 9,
    }), false);
  });

  it.each([{ query: "hello" }, { sortBy: "view_count" as const }])("keeps %j uncached", async (options) => {
    const db = createMockDb();
    vi.mocked(rawPosts.listPosts).mockResolvedValue({ posts: [], total: 0 });
    await Promise.all([content.listPosts(db, options), content.listPosts(db, options)]);
    expect(rawPosts.listPosts).toHaveBeenCalledTimes(2);
  });

  it.each([NaN, Infinity, 0, -1])("normalizes invalid paging values %s", async (value) => {
    const db = createMockDb();
    vi.mocked(rawPosts.listPosts).mockResolvedValue({ posts: [], total: 0 });
    await content.listPosts(db, { page: value, pageSize: value });
    expect(rawPosts.listPosts).toHaveBeenCalledWith(db, expect.objectContaining({ page: 1, pageSize: 20 }), false);
  });

  it("loads settings without the old TTL and caches only public author fields", async () => {
    const db = createMockDb();
    vi.mocked(rawSettings.getSiteSettings).mockResolvedValue({ defaultHumanId: "owner" } as never);
    vi.mocked(rawHumans.getDefaultHuman).mockResolvedValue({
      id: "owner", name: "Owner", slug: "owner", avatar_version: "1", email: "private@example.com",
    } as never);
    expect(await content.getDefaultHuman(db)).toEqual({ id: "owner", name: "Owner", slug: "owner", avatar_version: "1" });
    expect(rawSettings.getSiteSettings).toHaveBeenCalledWith(db, false);
    expect(rawHumans.getDefaultHuman).toHaveBeenCalledWith(db, "owner");
    vi.clearAllMocks();
    expect(await content.getDefaultHuman(db, null)).toBeNull();
    expect(rawSettings.getSiteSettings).not.toHaveBeenCalled();
    vi.mocked(rawHumans.getDefaultHuman).mockResolvedValue(null);
    expect(await content.getDefaultHuman(db, "deleted")).toBeNull();
  });

  it("reuses taxonomy lists for slug lookups without caching arbitrary misses", async () => {
    const db = createMockDb();
    vi.mocked(rawCategories.listCategories).mockResolvedValue([{ id: "c", slug: "cat" }] as never);
    vi.mocked(rawTags.listTags).mockResolvedValue([{ id: "t", slug: "tag" }] as never);
    expect(await content.getCategoryBySlug(db, "cat")).toEqual({ id: "c", slug: "cat" });
    expect(await content.getCategoryBySlug(db, "missing")).toBeNull();
    expect(await content.getTagBySlug(db, "tag")).toEqual({ id: "t", slug: "tag" });
    expect(await content.getTagBySlug(db, "missing")).toBeNull();
    expect(rawCategories.listCategories).toHaveBeenCalledWith(db, false);
    expect(rawTags.listTags).toHaveBeenCalledWith(db, false);
  });

  it("loads published articles, tags, archives and navigation using explicit keys", async () => {
    const db = createMockDb();
    const post = createMockPostWithAgent();
    vi.mocked(rawPosts.getPostBySlug).mockResolvedValue(post);
    vi.mocked(rawPosts.getPostTags).mockResolvedValue([]);
    vi.mocked(rawPosts.getAdjacentPosts).mockResolvedValue({ prev: null, next: null });
    vi.mocked(rawPosts.listMonthlyArchives).mockResolvedValue([]);
    expect(await content.getPostBySlug(db, post.slug)).toBe(post);
    expect(rawPosts.getPostBySlug).toHaveBeenCalledWith(db, post.slug, "published");
    expect(await content.getPostTags(db, post.id)).toEqual([]);
    expect(await content.getAdjacentPosts(db, 123, post.id)).toEqual({ prev: null, next: null });
    expect(rawPosts.getAdjacentPosts).toHaveBeenCalledWith(db, 123, post.id);
    expect(await content.listMonthlyArchives(db)).toEqual([]);
    expect(rawPosts.listMonthlyArchives).toHaveBeenCalledWith(db, false);
  });

  it("omits private email from comments and body content from the sitemap query", async () => {
    const db = createMockDb();
    vi.mocked(rawComments.listCommentsByPost).mockResolvedValue([{ id: "comment", content: "Hello", author_email: "private@example.com" }] as never);
    expect(await content.listCommentsByPost(db, "post")).toEqual([{ id: "comment", content: "Hello", author_email: null }]);
    vi.mocked(db.query).mockResolvedValue({ results: [{ slug: "post" }], meta: { changes: 0, duration: 0 } });
    expect(await content.listSitemapPosts(db)).toEqual({ posts: [{ slug: "post" }] });
    const sql = vi.mocked(db.query).mock.calls[0][0];
    expect(sql).toContain("status = 'published'");
    expect(sql).not.toContain("content");
    expect(sql).not.toContain("*");
  });
});
