import { beforeAll, describe, expect, it } from "vitest";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:17028";
const WORKER = "http://localhost:8787";
const RUN_ID = process.env.E2E_RUN_ID;

function request(path: string, init: RequestInit = {}) {
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: { "x-forwarded-proto": "https", "User-Agent": "Uptime-Kuma/2.0", ...init.headers },
  });
}

function write(path: string, body: unknown, method = "POST") {
  return request(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

async function sql(statement: string, params: unknown[] = []) {
  const response = await fetch(`${WORKER}/api/v1/${/^SELECT/.test(statement) ? "query" : "execute"}`, {
    method: "POST",
    headers: { Authorization: "Bearer test-secret", "Content-Type": "application/json" },
    body: JSON.stringify({ sql: statement, params }),
  });
  expect(response.status).toBe(200);
  return response.json();
}

beforeAll(async () => {
  // Direct SQL is intentional evidence of a cache hit, and is allowed only in
  // this run's local, marked test database. No production fallback.
  expect(["http://localhost:17028", "http://localhost:27028"]).toContain(BASE);
  expect(process.env.WORKER_URL).toBe(WORKER);
  expect(RUN_ID).toBeTruthy();
  const marker = await sql("SELECT run_id FROM _test_marker");
  expect(marker.results).toEqual([{ run_id: RUN_ID }]);
});

describe("real Next.js public cache", () => {
  it("reuses content across HTTP requests and refreshes REST/MCP edits and withdrawals", async () => {
    const slug = `cache-${crypto.randomUUID()}`;
    const categoryResponse = await write("/api/categories", { name: "Cache category", slug });
    expect(categoryResponse.status).toBe(201);
    const category = await categoryResponse.json();
    const created = await write("/api/posts", {
      slug, title: "Cache original title", content: "Cache body", status: "published", categoryId: category.id,
      featuredImage: "https://example.com/cache.jpg",
    });
    expect(created.status).toBe(201);
    const post = await created.json();
    const date = new Date(post.published_at * 1000).toISOString();
    const articlePath = `/${date.slice(0, 4)}/${date.slice(5, 7)}/${slug}`;
    const paths = [articlePath, `/api/md${articlePath}`, "/api/md", "/feed.xml", "/sitemap.xml"];
    let currentSlug = slug;
    try {
      expect((await (await request(`/api/posts/${slug}`)).json()).title).toBe("Cache original title");
      const listPath = `/api/posts?category_id=${category.id}`;
      expect((await (await request(listPath)).json()).posts[0].title).toBe("Cache original title");
      for (const path of paths) expect(await (await request(path)).text()).toContain("Cache original title");

      await sql("UPDATE posts SET title = ? WHERE id = ?", ["Direct SQL title", post.id]);
      expect((await sql("SELECT title FROM posts WHERE id = ?", [post.id])).results[0].title).toBe("Direct SQL title");
      for (let i = 0; i < 3; i++) {
        expect((await (await request(`/api/posts/${slug}`)).json()).title).toBe("Cache original title");
        expect((await (await request(listPath)).json()).posts[0].title).toBe("Cache original title");
      }
      for (const path of paths) expect(await (await request(path)).text()).toContain("Cache original title");

      expect((await write(`/api/posts/${slug}`, { title: "Updated through REST" }, "PUT")).status).toBe(200);
      expect((await (await request(`/api/posts/${slug}`)).json()).title).toBe("Updated through REST");
      for (const path of paths) {
        const response = await request(path);
        expect(response.status).toBe(200);
        expect(await response.text()).toContain("Updated through REST");
      }

      const token = await (await write("/api/mcp/tokens", { client_name: "cache-e2e" })).json();
      try {
        const response = await request("/api/mcp", {
          method: "POST",
          headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "update_post", arguments: { slug, title: "Updated through MCP" } } }),
        });
        expect(response.status).toBe(200);
        expect((await response.json()).result.isError).toBeUndefined();
        expect((await (await request(`/api/posts/${slug}`)).json()).title).toBe("Updated through MCP");
      } finally {
        await request(`/api/mcp/tokens/${token.id}`, { method: "DELETE" });
      }

      currentSlug = `${slug}-renamed`;
      expect((await write(`/api/posts/${slug}`, { slug: currentSlug }, "PUT")).status).toBe(200);
      expect((await request(`/api/posts/${slug}`)).status).toBe(404);
      expect((await request(`/api/posts/${currentSlug}`)).status).toBe(200);
      expect((await write(`/api/posts/${currentSlug}`, { status: "private" }, "PUT")).status).toBe(200);
      expect((await request(`/api/posts/${currentSlug}`)).status).toBe(404);
      expect((await request(articlePath.replace(slug, currentSlug))).status).toBe(404);
      expect((await request(`/api/md${articlePath.replace(slug, currentSlug)}`)).status).toBe(404);
      for (const path of ["/feed.xml", "/sitemap.xml", "/api/md"]) {
        expect(await (await request(path)).text()).not.toContain(currentSlug);
      }
      // Republishing must clear the negative cache immediately.
      expect((await write(`/api/posts/${currentSlug}`, { status: "published" }, "PUT")).status).toBe(200);
      expect((await request(`/api/posts/${currentSlug}`)).status).toBe(200);
    } finally {
      await request(`/api/posts/${currentSlug}`, { method: "DELETE" });
      await request(`/api/categories/${category.slug}`, { method: "DELETE" });
    }
    expect((await request(`/api/posts/${currentSlug}`)).status).toBe(404);
  });

  it("invalidates taxonomy, comments and settings in rendered content", async () => {
    const slug = `cache-comments-${crypto.randomUUID()}`;
    const settings = await (await request("/api/settings")).json();
    const category = await (await write("/api/categories", { name: "Original category", slug })).json();
    const post = await (await write("/api/posts", { title: "Comments cache", slug, content: "Body", status: "published", categoryId: category.id, commentEnabled: 1 })).json();
    const date = new Date(post.published_at * 1000).toISOString();
    const path = `/${date.slice(0, 4)}/${date.slice(5, 7)}/${slug}`;
    try {
      expect(await (await request(path)).text()).toContain("Original category");
      expect((await write(`/api/categories/${category.slug}`, { name: "Updated cache category" }, "PUT")).status).toBe(200);
      expect(await (await request(path)).text()).toContain("Updated cache category");
      await write("/api/settings", { commentsEnabled: true, siteDescription: "Cache description updated" }, "PUT");
      expect(await (await request("/api/md")).text()).toContain("Cache description updated");
      const commentResponse = await write("/api/comments", { post_id: post.id, content: "Fresh cache comment" });
      expect(commentResponse.status).toBe(201);
      const comment = await commentResponse.json();
      const html = await (await request(path)).text();
      expect(html).toContain("Fresh cache comment");
      expect(html).not.toContain("e2e@test.local");
      expect((await request(`/api/admin/comments/${comment.id}`, { method: "DELETE" })).status).toBe(200);
      expect(await (await request(path)).text()).not.toContain("Fresh cache comment");
    } finally {
      await write("/api/settings", { commentsEnabled: settings.commentsEnabled, siteDescription: settings.siteDescription }, "PUT");
      await request(`/api/posts/${slug}`, { method: "DELETE" });
      await request(`/api/categories/${category.slug}`, { method: "DELETE" });
    }
  });

  it("does not write analytics for Kuma, HEAD or explicit prefetch traffic", async () => {
    const count = async () => (await sql("SELECT COUNT(*) AS n FROM page_views")).results[0].n;
    const before = await count();
    expect((await request("/")).status).toBe(200);
    expect((await request("/", { method: "HEAD", headers: { "User-Agent": "Mozilla/5.0 cache-test" } })).status).toBe(200);
    expect((await request("/", { headers: { "User-Agent": "Mozilla/5.0 cache-test", Purpose: "prefetch" } })).status).toBe(200);
    expect((await request("/", { headers: { "User-Agent": "Mozilla/5.0 cache-test", "next-router-prefetch": "1" } })).status).toBe(200);
    // waitUntil analytics, if accidentally scheduled, completes before the check.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(await count()).toBe(before);
  });
});
