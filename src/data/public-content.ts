import type { Db } from "@/lib/db";
import type { Human, PostWithAgent } from "@/models/types";
import { readPublicContent } from "./core/public-cache";
import * as posts from "./entities/post";
import * as categories from "./entities/category";
import * as tags from "./entities/tag";
import * as settings from "./settings";
import { getDefaultHuman as loadDefaultHuman } from "./entities/human";
import { listCommentsByPost as loadComments } from "./entities/comment";

export type { ListPostsOptions } from "./entities/post";

export function getSiteSettings(db: Db) {
  return readPublicContent(["settings"], () => settings.getSiteSettings(db, false));
}

export async function getDefaultHuman(db: Db, defaultId?: string | null) {
  const defaultHumanId = defaultId === undefined ? (await getSiteSettings(db)).defaultHumanId : defaultId;
  if (!defaultHumanId) return null;
  return readPublicContent(["default-human", defaultHumanId], async () => {
    const human = await loadDefaultHuman(db, defaultHumanId);
    if (!human) return null;
    const { id, name, slug, avatar_version } = human;
    return { id, name, slug, avatar_version } satisfies Pick<Human, "id" | "name" | "slug" | "avatar_version">;
  });
}

export function listCategories(db: Db) {
  return readPublicContent(["categories"], () => categories.listCategories(db, false));
}

export function listTags(db: Db) {
  return readPublicContent(["tags"], () => tags.listTags(db, false));
}

export async function getCategoryBySlug(db: Db, slug: string) {
  return (await listCategories(db)).find((category) => category.slug === slug) ?? null;
}

export async function getTagBySlug(db: Db, slug: string) {
  return (await listTags(db)).find((tag) => tag.slug === slug) ?? null;
}

export function listMonthlyArchives(db: Db) {
  return readPublicContent(["archives"], () => posts.listMonthlyArchives(db, false));
}

export function listPosts(db: Db, options: posts.ListPostsOptions = {}) {
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 20;
  const normalized: posts.ListPostsOptions = {
    status: "published",
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    pageSize: Number.isFinite(pageSize) && pageSize >= 1
      ? Math.min(100, Math.floor(pageSize)) : 20,
    sortBy: options.sortBy ?? "published_at",
    sortOrder: options.sortOrder ?? "desc",
    categoryId: options.categoryId,
    tagId: options.tagId,
    aiAgentId: options.aiAgentId,
    archiveYear: options.archiveYear,
    archiveMonth: options.archiveMonth,
    query: options.query,
  };
  const load = () => posts.listPosts(db, normalized, false);
  // Arbitrary searches and live rankings should not create long-lived keys.
  if (options.query || options.sortBy === "view_count") return load();
  return readPublicContent(["posts", normalized], load);
}

export function getPostBySlug(db: Db, slug: string) {
  return readPublicContent(["post", slug], () => posts.getPostBySlug(db, slug, "published"));
}

export function getPostTags(db: Db, id: string) {
  return readPublicContent(["post-tags", id], () => posts.getPostTags(db, id));
}

export function getAdjacentPosts(db: Db, publishedAt: number, id: string) {
  return readPublicContent(["adjacent", publishedAt, id], () => posts.getAdjacentPosts(db, publishedAt, id));
}

export function listCommentsByPost(db: Db, id: string) {
  return readPublicContent(["comments", id], async () =>
    (await loadComments(db, id)).map((comment) => ({ ...comment, author_email: null })));
}

type SitemapPost = Pick<PostWithAgent, "slug" | "title" | "published_at" | "updated_at" | "featured_image">;

export function listSitemapPosts(db: Db) {
  return readPublicContent(["sitemap-posts"], async () => {
    const { results } = await db.query<SitemapPost>(
      "SELECT slug, title, published_at, updated_at, featured_image FROM posts WHERE status = 'published'",
    );
    return { posts: results };
  });
}
