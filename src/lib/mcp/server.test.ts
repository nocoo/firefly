import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import { createMcpServer } from "./server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

// ---------------------------------------------------------------------------
// Mock all tool handler modules
// ---------------------------------------------------------------------------

vi.mock("@/lib/mcp/tools/posts", () => ({
  handleListPosts: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "[]" }] }),
  handleGetPost: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "{}" }] }),
  handleCreatePost: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "{}" }] }),
  handleUpdatePost: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "{}" }] }),
  handleDeletePost: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "{}" }] }),
  handleGenerateExcerpt: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "{}" }] }),
}));

vi.mock("@/lib/mcp/tools/tags", () => ({
  handleListTags: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "[]" }] }),
  handleGetTag: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "{}" }] }),
  handleCreateTag: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "{}" }] }),
  handleUpdateTag: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "{}" }] }),
  handleDeleteTag: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "{}" }] }),
}));

vi.mock("@/lib/mcp/tools/categories", () => ({
  handleListCategories: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "[]" }] }),
  handleGetCategory: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "{}" }] }),
  handleCreateCategory: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "{}" }] }),
  handleUpdateCategory: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "{}" }] }),
  handleDeleteCategory: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "{}" }] }),
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
    // Stateless mode (no session ID)
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

  // Clean up (non-blocking)
  transport.close().catch(() => {});
  server.close().catch(() => {});

  return response;
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

  it("registers exactly 16 tools", async () => {
    // First initialize, then list tools in a batch
    // Or use a stateful session for multi-request testing
    const server = createMcpServer(db);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => "test-session",
      enableJsonResponse: true,
    });
    await server.connect(transport);

    // Initialize
    const initResponse = await transport.handleRequest(
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
    expect(initResponse.status).toBe(200);

    const sessionId = initResponse.headers.get("mcp-session-id");
    expect(sessionId).toBeTruthy();

    // Send initialized notification
    await transport.handleRequest(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: { ...MCP_HEADERS, "mcp-session-id": sessionId! },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "notifications/initialized",
        }),
      }),
    );

    // List tools
    const listResponse = await transport.handleRequest(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: { ...MCP_HEADERS, "mcp-session-id": sessionId! },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/list",
        }),
      }),
    );

    expect(listResponse.status).toBe(200);
    const body = await listResponse.json();
    expect(body.result.tools).toHaveLength(17);

    // Verify all expected tool names
    const names = body.result.tools.map((t: { name: string }) => t.name).sort();
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
    const server = createMcpServer(db);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => "test-session-2",
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
        headers: {
          ...MCP_HEADERS,
          "mcp-session-id": sessionId,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "notifications/initialized",
        }),
      }),
    );

    // List tools
    const response = await transport.handleRequest(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: {
          ...MCP_HEADERS,
          "mcp-session-id": sessionId,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/list",
        }),
      }),
    );

    const body = await response.json();
    const tools = body.result.tools as { name: string; inputSchema: Record<string, unknown> }[];

    // create_post requires title, slug, content
    const createPost = tools.find((t) => t.name === "create_post");
    expect(createPost?.inputSchema.required).toEqual(
      expect.arrayContaining(["title", "slug", "content"]),
    );

    // list_posts has no required fields
    const listPosts = tools.find((t) => t.name === "list_posts");
    expect(listPosts?.inputSchema.required ?? []).toEqual([]);

    // get_tag requires slug
    const getTag = tools.find((t) => t.name === "get_tag");
    expect(getTag?.inputSchema.required).toEqual(["slug"]);

    await transport.close();
    await server.close();
  });

  // Helper: create a stateful session and return tools for calling
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

    return { server, transport, callTool };
  }

  it("invokes post tools through the protocol", async () => {
    const { server, transport, callTool } = await createSession(db);

    const listResult = await callTool("list_posts");
    expect(listResult.result?.content?.[0]?.text ?? listResult.error).toBeDefined();

    const getResult = await callTool("get_post", { slug: "test" });
    expect(getResult.result?.content?.[0]?.text ?? getResult.error).toBeDefined();

    const createResult = await callTool("create_post", {
      title: "T",
      slug: "s",
      content: "C",
    });
    expect(createResult.result?.content?.[0]?.text ?? createResult.error).toBeDefined();

    const updateResult = await callTool("update_post", { slug: "s" });
    expect(updateResult.result?.content?.[0]?.text ?? updateResult.error).toBeDefined();

    const deleteResult = await callTool("delete_post", { slug: "s" });
    expect(deleteResult.result?.content?.[0]?.text ?? deleteResult.error).toBeDefined();

    await transport.close();
    await server.close();
  });

  it("invokes tag tools through the protocol", async () => {
    const { server, transport, callTool } = await createSession(db);

    const listResult = await callTool("list_tags");
    expect(listResult.result?.content?.[0]?.text ?? listResult.error).toBeDefined();

    const getResult = await callTool("get_tag", { slug: "ts" });
    expect(getResult.result?.content?.[0]?.text ?? getResult.error).toBeDefined();

    const createResult = await callTool("create_tag", { name: "N", slug: "n" });
    expect(createResult.result?.content?.[0]?.text ?? createResult.error).toBeDefined();

    const updateResult = await callTool("update_tag", { slug: "n" });
    expect(updateResult.result?.content?.[0]?.text ?? updateResult.error).toBeDefined();

    const deleteResult = await callTool("delete_tag", { slug: "n" });
    expect(deleteResult.result?.content?.[0]?.text ?? deleteResult.error).toBeDefined();

    await transport.close();
    await server.close();
  });

  it("invokes category tools through the protocol", async () => {
    const { server, transport, callTool } = await createSession(db);

    const listResult = await callTool("list_categories");
    expect(listResult.result?.content?.[0]?.text ?? listResult.error).toBeDefined();

    const getResult = await callTool("get_category", { slug: "tech" });
    expect(getResult.result?.content?.[0]?.text ?? getResult.error).toBeDefined();

    const createResult = await callTool("create_category", { name: "N", slug: "n" });
    expect(createResult.result?.content?.[0]?.text ?? createResult.error).toBeDefined();

    const updateResult = await callTool("update_category", { slug: "n" });
    expect(updateResult.result?.content?.[0]?.text ?? updateResult.error).toBeDefined();

    const deleteResult = await callTool("delete_category", { slug: "n" });
    expect(deleteResult.result?.content?.[0]?.text ?? deleteResult.error).toBeDefined();

    await transport.close();
    await server.close();
  });
});
