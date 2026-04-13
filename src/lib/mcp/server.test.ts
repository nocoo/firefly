// ---------------------------------------------------------------------------
// MCP Server — Integration Tests
// ---------------------------------------------------------------------------
//
// Verifies that createMcpServer registers all entity tools correctly and
// that JSON-RPC round-trips produce correct success/error responses.
// Data layer functions are mocked to return valid entities for known
// IDs/slugs, so we can distinguish success from error paths.

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import { createMockDb } from "@/data/core/test-utils";
import { createMcpServer, type McpServerContext } from "./server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

// ---------------------------------------------------------------------------
// Mock all data layer modules used by entity configs
//
// NOTE: vi.mock factories are hoisted above all imports and variable
// declarations, so we cannot reference module-level constants here.
// All mock data must be inlined.
// ---------------------------------------------------------------------------

vi.mock("@/data/entities/tag", () => {
  const tag = { id: "t-1", name: "TypeScript", slug: "typescript", post_count: 5, created_at: 0, updated_at: 0 };
  return {
    listTags: vi.fn(async () => [tag]),
    getTagById: vi.fn(async (_: unknown, id: string) => (id === "t-1" ? tag : null)),
    getTagBySlug: vi.fn(async (_: unknown, slug: string) => (slug === "typescript" ? tag : null)),
    createTag: vi.fn(async () => tag),
    updateTag: vi.fn(async () => ({ ...tag, name: "TS" })),
    deleteTag: vi.fn(async () => true),
  };
});

vi.mock("@/data/entities/category", () => {
  const cat = { id: "c-1", name: "Tech", slug: "tech", description: "Technology", sort_order: 0, post_count: 10, created_at: 0, updated_at: 0 };
  return {
    listCategories: vi.fn(async () => [cat]),
    getCategoryById: vi.fn(async (_: unknown, id: string) => (id === "c-1" ? cat : null)),
    getCategoryBySlug: vi.fn(async (_: unknown, slug: string) => (slug === "tech" ? cat : null)),
    createCategory: vi.fn(async () => cat),
    updateCategory: vi.fn(async () => ({ ...cat, name: "Technology" })),
    deleteCategory: vi.fn(async () => true),
  };
});

vi.mock("@/data/entities/post", () => {
  const post = {
    id: "p-1", title: "Hello World", slug: "hello-world",
    content: "Body text", content_html: "<p>Body text</p>",
    status: "published", excerpt: "Intro",
    category_id: "c-1", featured_image: null,
    published_at: 0, created_at: 0, updated_at: 0,
    wp_id: null, wp_permalink: null, comment_enabled: true,
    reference_url: null, reference_title: null,
    reference_description: null, reference_image: null,
  };
  const tag = { id: "t-1", name: "TypeScript", slug: "typescript", post_count: 5, created_at: 0, updated_at: 0 };
  return {
    listPosts: vi.fn(async () => ({ posts: [post], total: 1 })),
    getPostById: vi.fn(async (_: unknown, id: string) => (id === "p-1" ? post : null)),
    getPostBySlug: vi.fn(async (_: unknown, slug: string) => (slug === "hello-world" ? post : null)),
    updatePost: vi.fn(async () => ({ ...post, title: "Updated" })),
    getPostTags: vi.fn(async () => [tag]),
  };
});

vi.mock("@/services/post-service", () => {
  const post = {
    id: "p-1", title: "Hello World", slug: "hello-world",
    content: "Body text", content_html: "<p>Body text</p>",
    status: "published", excerpt: "Intro",
    category_id: "c-1", featured_image: null,
    published_at: 0, created_at: 0, updated_at: 0,
    wp_id: null, wp_permalink: null, comment_enabled: true,
    reference_url: null, reference_title: null,
    reference_description: null, reference_image: null,
  };
  return {
    PostService: {
      create: vi.fn(async () => post),
      update: vi.fn(async () => ({ ...post, title: "Updated" })),
      delete: vi.fn(async () => true),
    },
  };
});

vi.mock("@/services/ai", () => ({
  generateExcerpt: vi.fn(async () => "An excerpt"),
  summarizeUnfurl: vi.fn(async () => null),
}));

vi.mock("@/services/unfurl", () => ({
  unfurlUrl: vi.fn(async () => ({
    url: "https://example.com",
    ogTitle: "Example",
    ogDescription: "Desc",
    pageTitle: "Example",
    bodyText: "text",
    ogImage: null,
    readmeImage: null,
  })),
  UnfurlError: class UnfurlError extends Error {},
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------


/** Common headers for MCP JSON-RPC requests. */
const MCP_HEADERS = {
  "Content-Type": "application/json",
  "Accept": "application/json, text/event-stream",
};

/** Send a stateless JSON-RPC request to a fresh server+transport pair. */
async function sendStatelessRequest(
  db: Db,
  body: unknown,
  context?: McpServerContext,
): Promise<Response> {
  const server = createMcpServer(db, context);
  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
  });
  await server.connect(transport);

  const response = await transport.handleRequest(
    new Request("http://localhost/mcp", {
      method: "POST",
      headers: MCP_HEADERS,
      body: JSON.stringify(body),
    }),
  );

  transport.close().catch(() => {});
  server.close().catch(() => {});

  return response;
}

/** Create a stateful MCP session and return a callTool helper. */
async function createSession(db: Db, context?: McpServerContext) {
  const server = createMcpServer(db, context);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => `sess-${Math.random()}`,
    enableJsonResponse: true,
  });
  await server.connect(transport);

  // Initialize
  const initRes = await transport.handleRequest(
    new Request("http://localhost/mcp", {
      method: "POST",
      headers: MCP_HEADERS,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "test", version: "0.0.1" },
        },
      }),
    }),
  );
  const sessionId = initRes.headers.get("mcp-session-id")!;

  // Initialized notification
  await transport.handleRequest(
    new Request("http://localhost/mcp", {
      method: "POST",
      headers: { ...MCP_HEADERS, "mcp-session-id": sessionId },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
    }),
  );

  const callTool = async (name: string, args: Record<string, unknown> = {}) => {
    const res = await transport.handleRequest(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: { ...MCP_HEADERS, "mcp-session-id": sessionId },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Math.floor(Math.random() * 100000),
          method: "tools/call",
          params: { name, arguments: args },
        }),
      }),
    );
    return res.json();
  };

  const listTools = async () => {
    const res = await transport.handleRequest(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: { ...MCP_HEADERS, "mcp-session-id": sessionId },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/list",
        }),
      }),
    );
    return res.json();
  };

  return { server, transport, callTool, listTools };
}

/** Parse tool result text and assert it succeeded (no isError). */
function expectSuccess(result: Record<string, unknown>): unknown {
  // If JSON-RPC error, fail with the error message
  if (result.error) {
    const err = result.error as Record<string, unknown>;
    throw new Error(`Unexpected JSON-RPC error: ${err.message ?? JSON.stringify(err)}`);
  }
  const r = result.result as Record<string, unknown>;
  expect(r.isError).toBeUndefined();
  const text = (r.content as { type: string; text: string }[])[0].text;
  return JSON.parse(text);
}

/** Assert tool result is an error with isError: true (tool-level, not JSON-RPC error). */
function expectToolError(result: Record<string, unknown>, substring?: string): void {
  // If JSON-RPC error, fail with the error message
  if (result.error) {
    const err = result.error as Record<string, unknown>;
    throw new Error(`Unexpected JSON-RPC error: ${err.message ?? JSON.stringify(err)}`);
  }
  const r = result.result as Record<string, unknown>;
  expect(r.isError).toBe(true);
  if (substring) {
    const text = (r.content as { type: string; text: string }[])[0].text;
    expect(text).toContain(substring);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createMcpServer", () => {
  let db: Db;

  beforeEach(() => {
    db = createMockDb();
  });

  it("creates a server instance", () => {
    const server = createMcpServer(db);
    expect(server).toBeDefined();
  });

  it("handles initialize request", async () => {
    const response = await sendStatelessRequest(db, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test", version: "0.0.1" },
      },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.result.serverInfo.name).toBe("firefly");
  });

  it("registers exactly 17 tools with expected names", async () => {
    const { server, transport, listTools } = await createSession(db);

    const body = await listTools();
    expect(body.result.tools).toHaveLength(17);

    const names = body.result.tools
      .map((t: { name: string }) => t.name)
      .sort();
    expect(names).toEqual([
      "create_category",
      "create_post",
      "create_tag",
      "delete_category",
      "delete_post",
      "delete_tag",
      "generate_excerpt",
      "get_category",
      "get_post",
      "get_tag",
      "list_categories",
      "list_posts",
      "list_tags",
      "unfurl_reference",
      "update_category",
      "update_post",
      "update_tag",
    ]);

    await transport.close();
    await server.close();
  });

  it("tools have proper input schemas", async () => {
    const { server, transport, listTools } = await createSession(db);

    const body = await listTools();
    const tools = body.result.tools as {
      name: string;
      inputSchema: Record<string, unknown>;
    }[];

    // create_post requires title, slug, content
    const createPost = tools.find((t) => t.name === "create_post");
    expect(createPost?.inputSchema.required).toEqual(
      expect.arrayContaining(["title", "slug", "content"]),
    );

    // list_posts has no required fields (all optional + include)
    const listPosts = tools.find((t) => t.name === "list_posts");
    expect(listPosts?.inputSchema.required ?? []).toEqual([]);

    // list_posts has include param (projection configured)
    const listPostsProps = listPosts?.inputSchema.properties as
      | Record<string, unknown>
      | undefined;
    expect(listPostsProps).toHaveProperty("include");

    // get_tag: id and slug are both optional (no required fields)
    const getTag = tools.find((t) => t.name === "get_tag");
    expect(getTag?.inputSchema.required ?? []).toEqual([]);

    // get_post: id and slug are both optional
    const getPost = tools.find((t) => t.name === "get_post");
    expect(getPost?.inputSchema.required ?? []).toEqual([]);

    // update_post has id and slug as optional identifiers
    const updatePost = tools.find((t) => t.name === "update_post");
    const updatePostProps = updatePost?.inputSchema.properties as
      | Record<string, unknown>
      | undefined;
    expect(updatePostProps).toHaveProperty("id");
    expect(updatePostProps).toHaveProperty("slug");

    // generate_excerpt has id and slug as optional identifiers
    const genExcerpt = tools.find((t) => t.name === "generate_excerpt");
    expect(genExcerpt?.inputSchema.required ?? []).toEqual([]);

    await transport.close();
    await server.close();
  });

  // ---- Post tools: success + error paths ----

  it("post tools succeed with valid data", async () => {
    const { server, transport, callTool } = await createSession(db);

    // list_posts → success with posts array
    const listData = expectSuccess(await callTool("list_posts")) as Record<string, unknown>;
    expect(listData).toHaveProperty("posts");
    expect(listData).toHaveProperty("total");

    // get_post by slug → success with post data
    const getBySlug = expectSuccess(await callTool("get_post", { slug: "hello-world" })) as Record<string, unknown>;
    expect(getBySlug.slug).toBe("hello-world");
    expect(getBySlug.title).toBe("Hello World");

    // get_post by id → success
    const getById = expectSuccess(await callTool("get_post", { id: "p-1" })) as Record<string, unknown>;
    expect(getById.id).toBe("p-1");

    // create_post → success
    const created = expectSuccess(await callTool("create_post", {
      title: "T", slug: "s", content: "C",
    })) as Record<string, unknown>;
    expect(created.slug).toBe("hello-world");

    // update_post by slug → success
    const updated = expectSuccess(await callTool("update_post", { slug: "hello-world" })) as Record<string, unknown>;
    expect(updated.title).toBe("Updated");

    // delete_post by slug → success
    const deleted = expectSuccess(await callTool("delete_post", { slug: "hello-world" })) as Record<string, unknown>;
    expect(deleted.deleted).toBe(true);

    await transport.close();
    await server.close();
  });

  it("post tools return errors for missing entities", async () => {
    const { server, transport, callTool } = await createSession(db);

    // get_post with unknown slug → error
    expectToolError(await callTool("get_post", { slug: "nonexistent" }), "not found");

    // update_post with unknown slug → error
    expectToolError(await callTool("update_post", { slug: "nonexistent" }), "not found");

    // delete_post with unknown slug → error
    expectToolError(await callTool("delete_post", { slug: "nonexistent" }), "not found");

    // get_post with both id and slug → conflict error
    expectToolError(await callTool("get_post", { id: "p-1", slug: "hello-world" }), "not both");

    // get_post with neither id nor slug → validation error
    expectToolError(await callTool("get_post", {}), "required");

    await transport.close();
    await server.close();
  });

  // ---- Tag tools: success + error paths ----

  it("tag tools succeed with valid data", async () => {
    const { server, transport, callTool } = await createSession(db);

    // list_tags → success with tag array
    const tags = expectSuccess(await callTool("list_tags")) as unknown[];
    expect(Array.isArray(tags)).toBe(true);
    expect(tags).toHaveLength(1);

    // get_tag by slug → success
    const tag = expectSuccess(await callTool("get_tag", { slug: "typescript" })) as Record<string, unknown>;
    expect(tag.name).toBe("TypeScript");

    // create_tag → success
    const created = expectSuccess(await callTool("create_tag", { name: "N", slug: "n" })) as Record<string, unknown>;
    expect(created.id).toBe("t-1");

    // update_tag by slug → success
    const updated = expectSuccess(await callTool("update_tag", { slug: "typescript" })) as Record<string, unknown>;
    expect(updated.name).toBe("TS");

    // delete_tag → success
    const deleted = expectSuccess(await callTool("delete_tag", { slug: "typescript" })) as Record<string, unknown>;
    expect(deleted.deleted).toBe(true);

    await transport.close();
    await server.close();
  });

  it("tag tools return errors for missing entities", async () => {
    const { server, transport, callTool } = await createSession(db);

    expectToolError(await callTool("get_tag", { slug: "nonexistent" }), "not found");
    expectToolError(await callTool("update_tag", { slug: "nonexistent" }), "not found");
    expectToolError(await callTool("delete_tag", { slug: "nonexistent" }), "not found");

    await transport.close();
    await server.close();
  });

  // ---- Category tools: success + error paths ----

  it("category tools succeed with valid data", async () => {
    const { server, transport, callTool } = await createSession(db);

    // list_categories → success
    const cats = expectSuccess(await callTool("list_categories")) as unknown[];
    expect(Array.isArray(cats)).toBe(true);
    expect(cats).toHaveLength(1);

    // get_category by slug → success
    const cat = expectSuccess(await callTool("get_category", { slug: "tech" })) as Record<string, unknown>;
    expect(cat.name).toBe("Tech");

    // create_category → success
    const created = expectSuccess(await callTool("create_category", { name: "N", slug: "n" })) as Record<string, unknown>;
    expect(created.id).toBe("c-1");

    // update_category → success
    const updated = expectSuccess(await callTool("update_category", { slug: "tech" })) as Record<string, unknown>;
    expect(updated.name).toBe("Technology");

    // delete_category → success
    const deleted = expectSuccess(await callTool("delete_category", { slug: "tech" })) as Record<string, unknown>;
    expect(deleted.deleted).toBe(true);

    await transport.close();
    await server.close();
  });

  it("category tools return errors for missing entities", async () => {
    const { server, transport, callTool } = await createSession(db);

    expectToolError(await callTool("get_category", { slug: "nonexistent" }), "not found");
    expectToolError(await callTool("update_category", { slug: "nonexistent" }), "not found");
    expectToolError(await callTool("delete_category", { slug: "nonexistent" }), "not found");

    await transport.close();
    await server.close();
  });
});

// ---------------------------------------------------------------------------
// Author Context Tests
// ---------------------------------------------------------------------------

describe("createMcpServer with author context", () => {
  let db: Db;

  const authorContext: McpServerContext = { type: "author", userEmail: "author@example.com" };

  beforeEach(() => {
    db = createMockDb();
  });

  it("creates a server instance with author context", () => {
    const server = createMcpServer(db, authorContext);
    expect(server).toBeDefined();
  });

  it("registers 8 tools for author context (post + tag read/create, no update/delete)", async () => {
    const { server, transport, listTools } = await createSession(db, authorContext);

    const body = await listTools();
    expect(body.result.tools).toHaveLength(8);

    const names = body.result.tools
      .map((t: { name: string }) => t.name)
      .sort();
    expect(names).toEqual([
      "create_post",
      "create_tag",
      "delete_post",
      "get_post",
      "get_tag",
      "list_posts",
      "list_tags",
      "update_post",
    ]);

    await transport.close();
    await server.close();
  });

  it("agent post tools do not include extra tools (generate_excerpt, unfurl_reference)", async () => {
    const { server, transport, listTools } = await createSession(db, authorContext);

    const body = await listTools();
    const names = body.result.tools.map((t: { name: string }) => t.name);

    expect(names).not.toContain("generate_excerpt");
    expect(names).not.toContain("unfurl_reference");

    await transport.close();
    await server.close();
  });

  it("agent create_post schema does not have status or category_id", async () => {
    const { server, transport, listTools } = await createSession(db, authorContext);

    const body = await listTools();
    const tools = body.result.tools as {
      name: string;
      inputSchema: { properties?: Record<string, unknown> };
    }[];

    const createPost = tools.find((t) => t.name === "create_post");
    const props = createPost?.inputSchema.properties ?? {};

    expect(props).not.toHaveProperty("status");
    expect(props).not.toHaveProperty("category_id");

    await transport.close();
    await server.close();
  });

  it("agent update_post schema does not have status or category_id", async () => {
    const { server, transport, listTools } = await createSession(db, authorContext);

    const body = await listTools();
    const tools = body.result.tools as {
      name: string;
      inputSchema: { properties?: Record<string, unknown> };
    }[];

    const updatePost = tools.find((t) => t.name === "update_post");
    const props = updatePost?.inputSchema.properties ?? {};

    expect(props).not.toHaveProperty("status");
    expect(props).not.toHaveProperty("category_id");

    await transport.close();
    await server.close();
  });

  it("full context registers all 17 tools", async () => {
    const fullContext: McpServerContext = { type: "full", userEmail: "admin@example.com" };
    const { server, transport, listTools } = await createSession(db, fullContext);

    const body = await listTools();
    expect(body.result.tools).toHaveLength(17);

    await transport.close();
    await server.close();
  });

  it("no context (undefined) registers all 17 tools (backward compatible)", async () => {
    const { server, transport, listTools } = await createSession(db);

    const body = await listTools();
    expect(body.result.tools).toHaveLength(17);

    await transport.close();
    await server.close();
  });
});
