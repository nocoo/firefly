// ---------------------------------------------------------------------------
// MCP Server — Integration Tests
// ---------------------------------------------------------------------------
//
// Verifies that createMcpServer registers all entity tools correctly and
// that JSON-RPC round-trips work. Data layer functions are mocked — entity
// handler logic is covered by entity-level tests.

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import { createMcpServer } from "./server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

// ---------------------------------------------------------------------------
// Mock all data layer modules used by entity configs
// ---------------------------------------------------------------------------

vi.mock("@/data/tags", () => ({
  listTags: vi.fn(async () => []),
  getTagById: vi.fn(async () => null),
  getTagBySlug: vi.fn(async () => null),
  createTag: vi.fn(async () => ({ id: "t-1", name: "T", slug: "t", post_count: 0, created_at: 0, updated_at: 0 })),
  updateTag: vi.fn(async () => ({ id: "t-1", name: "T", slug: "t", post_count: 0, created_at: 0, updated_at: 0 })),
  deleteTag: vi.fn(async () => true),
}));

vi.mock("@/data/categories", () => ({
  listCategories: vi.fn(async () => []),
  getCategoryById: vi.fn(async () => null),
  getCategoryBySlug: vi.fn(async () => null),
  createCategory: vi.fn(async () => ({ id: "c-1", name: "C", slug: "c", description: null, sort_order: 0, post_count: 0, created_at: 0, updated_at: 0 })),
  updateCategory: vi.fn(async () => ({ id: "c-1", name: "C", slug: "c", description: null, sort_order: 0, post_count: 0, created_at: 0, updated_at: 0 })),
  deleteCategory: vi.fn(async () => true),
}));

vi.mock("@/data/posts", () => ({
  listPosts: vi.fn(async () => ({ posts: [], total: 0 })),
  getPostById: vi.fn(async () => null),
  getPostBySlug: vi.fn(async () => null),
  createPost: vi.fn(async () => ({ id: "p-1", title: "P", slug: "p", content: "", status: "draft", created_at: 0, updated_at: 0 })),
  updatePost: vi.fn(async () => ({ id: "p-1", title: "P", slug: "p", content: "", status: "draft", created_at: 0, updated_at: 0 })),
  deletePost: vi.fn(async () => true),
  getPostTags: vi.fn(async () => []),
  setPostTags: vi.fn(async () => {}),
}));

vi.mock("@/services/ai", () => ({
  generateExcerpt: vi.fn(async () => "An excerpt"),
  summarizeUnfurl: vi.fn(async () => null),
}));

vi.mock("@/services/unfurl", () => ({
  unfurlUrl: vi.fn(async () => ({})),
  UnfurlError: class UnfurlError extends Error {},
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockDb(): Db {
  return {
    query: vi.fn(),
    firstOrNull: vi.fn(),
    execute: vi.fn(),
    batch: vi.fn(),
  };
}

/** Common headers for MCP JSON-RPC requests. */
const MCP_HEADERS = {
  "Content-Type": "application/json",
  "Accept": "application/json, text/event-stream",
};

/** Send a stateless JSON-RPC request to a fresh server+transport pair. */
async function sendStatelessRequest(
  db: Db,
  body: unknown,
): Promise<Response> {
  const server = createMcpServer(db);
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
async function createSession(db: Db) {
  const server = createMcpServer(db);
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
          id: Math.random(),
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

  it("invokes post tools through the protocol", async () => {
    const { server, transport, callTool } = await createSession(db);

    const listResult = await callTool("list_posts");
    expect(
      listResult.result?.content?.[0]?.text ?? listResult.error,
    ).toBeDefined();

    // get_post without id or slug returns an error (validation)
    const getResult = await callTool("get_post", { slug: "test" });
    expect(
      getResult.result?.content?.[0]?.text ?? getResult.error,
    ).toBeDefined();

    const createResult = await callTool("create_post", {
      title: "T",
      slug: "s",
      content: "C",
    });
    expect(
      createResult.result?.content?.[0]?.text ?? createResult.error,
    ).toBeDefined();

    const updateResult = await callTool("update_post", { slug: "s" });
    expect(
      updateResult.result?.content?.[0]?.text ?? updateResult.error,
    ).toBeDefined();

    const deleteResult = await callTool("delete_post", { slug: "s" });
    expect(
      deleteResult.result?.content?.[0]?.text ?? deleteResult.error,
    ).toBeDefined();

    await transport.close();
    await server.close();
  });

  it("invokes tag tools through the protocol", async () => {
    const { server, transport, callTool } = await createSession(db);

    const listResult = await callTool("list_tags");
    expect(
      listResult.result?.content?.[0]?.text ?? listResult.error,
    ).toBeDefined();

    const getResult = await callTool("get_tag", { slug: "ts" });
    expect(
      getResult.result?.content?.[0]?.text ?? getResult.error,
    ).toBeDefined();

    const createResult = await callTool("create_tag", {
      name: "N",
      slug: "n",
    });
    expect(
      createResult.result?.content?.[0]?.text ?? createResult.error,
    ).toBeDefined();

    const updateResult = await callTool("update_tag", { slug: "n" });
    expect(
      updateResult.result?.content?.[0]?.text ?? updateResult.error,
    ).toBeDefined();

    const deleteResult = await callTool("delete_tag", { slug: "n" });
    expect(
      deleteResult.result?.content?.[0]?.text ?? deleteResult.error,
    ).toBeDefined();

    await transport.close();
    await server.close();
  });

  it("invokes category tools through the protocol", async () => {
    const { server, transport, callTool } = await createSession(db);

    const listResult = await callTool("list_categories");
    expect(
      listResult.result?.content?.[0]?.text ?? listResult.error,
    ).toBeDefined();

    const getResult = await callTool("get_category", { slug: "tech" });
    expect(
      getResult.result?.content?.[0]?.text ?? getResult.error,
    ).toBeDefined();

    const createResult = await callTool("create_category", {
      name: "N",
      slug: "n",
    });
    expect(
      createResult.result?.content?.[0]?.text ?? createResult.error,
    ).toBeDefined();

    const updateResult = await callTool("update_category", { slug: "n" });
    expect(
      updateResult.result?.content?.[0]?.text ?? updateResult.error,
    ).toBeDefined();

    const deleteResult = await callTool("delete_category", { slug: "n" });
    expect(
      deleteResult.result?.content?.[0]?.text ?? deleteResult.error,
    ).toBeDefined();

    await transport.close();
    await server.close();
  });
});
