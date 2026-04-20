/**
 * L2 API E2E — MCP endpoints
 *
 * Tests cover: OAuth metadata discovery, client registration, token exchange
 * error paths, MCP main endpoint auth, tool calls, and admin token management.
 *
 * Token seed strategy: E2E runs with E2E_SKIP_AUTH=true, so we use
 * POST /api/mcp/tokens (admin create) to generate valid Bearer tokens.
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:17028";

const MCP_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a token via admin API and return { id, access_token } */
async function seedToken(clientName = "e2e-test"): Promise<{
  id: string;
  access_token: string;
}> {
  const res = await fetch(`${BASE}/api/mcp/tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_name: clientName }),
  });
  expect(res.status).toBe(201);
  return res.json();
}

/** Delete a token via admin API */
async function cleanupToken(id: string): Promise<void> {
  await fetch(`${BASE}/api/mcp/tokens/${id}`, { method: "DELETE" });
}

/** Send a JSON-RPC request to the MCP endpoint */
async function mcpRequest(
  body: unknown,
  token: string,
): Promise<Response> {
  return fetch(`${BASE}/api/mcp`, {
    method: "POST",
    headers: {
      ...MCP_HEADERS,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MCP Metadata Discovery", () => {
  it("GET /.well-known/oauth-authorization-server returns valid metadata", async () => {
    const res = await fetch(
      `${BASE}/.well-known/oauth-authorization-server`,
    );
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.issuer).toBeTruthy();
    expect(data.authorization_endpoint).toContain("/api/mcp/authorize");
    expect(data.token_endpoint).toContain("/api/mcp/token");
    expect(data.registration_endpoint).toContain("/api/mcp/register");
    expect(data.response_types_supported).toContain("code");
    expect(data.code_challenge_methods_supported).toContain("S256");
  });
});

describe("MCP Client Registration", () => {
  it("POST /api/mcp/register with valid data returns 201", async () => {
    const res = await fetch(`${BASE}/api/mcp/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_name: "E2E Test Client",
        redirect_uris: ["http://localhost:9999/callback"],
      }),
    });
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.client_id).toMatch(/^firefly_mcp_/);
    expect(data.client_name).toBe("E2E Test Client");
    expect(data.redirect_uris).toContain(
      "http://localhost:9999/callback",
    );
  });

  it("rejects missing client_name", async () => {
    const res = await fetch(`${BASE}/api/mcp/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        redirect_uris: ["http://localhost:9999/callback"],
      }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects non-loopback redirect_uri", async () => {
    const res = await fetch(`${BASE}/api/mcp/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_name: "Bad Client",
        redirect_uris: ["https://evil.com/callback"],
      }),
    });
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain("loopback");
  });
});

describe("MCP Token Exchange — Error Paths", () => {
  it("rejects unsupported grant_type", async () => {
    const form = new URLSearchParams();
    form.set("grant_type", "password");

    const res = await fetch(`${BASE}/api/mcp/token`, {
      method: "POST",
      body: form,
    });
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toBe("unsupported_grant_type");
  });

  it("rejects invalid authorization code", async () => {
    const form = new URLSearchParams();
    form.set("grant_type", "authorization_code");
    form.set("code", "invalid_code_xyz");
    form.set("redirect_uri", "http://localhost:9999/callback");
    form.set("client_id", "fake_client");
    form.set("code_verifier", "fake_verifier");

    const res = await fetch(`${BASE}/api/mcp/token`, {
      method: "POST",
      body: form,
    });
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toBe("invalid_grant");
  });
});

describe("MCP Main Endpoint — Auth", () => {
  it("returns 401 without Authorization header", async () => {
    const res = await fetch(`${BASE}/api/mcp`, {
      method: "POST",
      headers: MCP_HEADERS,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
      }),
    });
    expect(res.status).toBe(401);

    const data = await res.json();
    // Unified error message for security (doesn't reveal if token is missing vs invalid)
    expect(data.error).toContain("Invalid");
  });

  it("returns 401 with invalid Bearer token", async () => {
    const res = await fetch(`${BASE}/api/mcp`, {
      method: "POST",
      headers: {
        ...MCP_HEADERS,
        Authorization: "Bearer invalid_token_xyz",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
      }),
    });
    expect(res.status).toBe(401);

    const data = await res.json();
    expect(data.error).toContain("Invalid");
  });

  it("GET returns 405", async () => {
    const res = await fetch(`${BASE}/api/mcp`);
    expect(res.status).toBe(405);
  });
});

describe("MCP Main Endpoint — Tool Calls", () => {
  let tokenId: string;
  let accessToken: string;

  beforeAll(async () => {
    const seed = await seedToken("e2e-mcp-tools");
    tokenId = seed.id;
    accessToken = seed.access_token;
  });

  afterAll(async () => {
    await cleanupToken(tokenId);
  });

  it("initialize + tools/list returns 17 tools", async () => {
    // Step 1: Initialize
    const initRes = await mcpRequest(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "e2e-test", version: "1.0.0" },
        },
      },
      accessToken,
    );
    expect(initRes.status).toBe(200);

    const initData = await initRes.json();
    expect(initData.result.serverInfo.name).toBe("firefly");

    // Step 2: List tools (new stateless request)
    const listRes = await mcpRequest(
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
      },
      accessToken,
    );
    expect(listRes.status).toBe(200);

    const listData = await listRes.json();
    expect(listData.result.tools).toHaveLength(17);

    const toolNames = listData.result.tools.map(
      (t: { name: string }) => t.name,
    );
    expect(toolNames).toContain("list_posts");
    expect(toolNames).toContain("create_post");
    expect(toolNames).toContain("list_tags");
    expect(toolNames).toContain("list_categories");
  });

  it("tools/call list_tags returns tag array", async () => {
    const res = await mcpRequest(
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "list_tags", arguments: {} },
      },
      accessToken,
    );
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.result.content).toBeDefined();
    expect(data.result.content[0].type).toBe("text");
    // Parse the JSON text — should be an array of tags
    const tags = JSON.parse(data.result.content[0].text);
    expect(Array.isArray(tags)).toBe(true);
  });

  it("tools/call create_post + delete_post round trip", async () => {
    const slug = `e2e-mcp-post-${Date.now()}`;

    // Create
    const createRes = await mcpRequest(
      {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "create_post",
          arguments: {
            title: "E2E MCP Post",
            slug,
            content: "Created via MCP E2E test",
            status: "draft",
          },
        },
      },
      accessToken,
    );
    expect(createRes.status).toBe(200);

    const createData = await createRes.json();
    expect(createData.result.isError).toBeUndefined();
    const post = JSON.parse(createData.result.content[0].text);
    expect(post.slug).toBe(slug);

    // Delete (cleanup)
    const deleteRes = await mcpRequest(
      {
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: {
          name: "delete_post",
          arguments: { slug },
        },
      },
      accessToken,
    );
    expect(deleteRes.status).toBe(200);
  });

  it("get_post by ID returns the post", async () => {
    const slug = `e2e-id-lookup-${Date.now()}`;

    // Create a post
    const createRes = await mcpRequest(
      {
        jsonrpc: "2.0",
        id: 10,
        method: "tools/call",
        params: {
          name: "create_post",
          arguments: {
            title: "E2E ID Lookup",
            slug,
            content: "Test content for ID lookup",
            status: "draft",
          },
        },
      },
      accessToken,
    );
    const created = JSON.parse(
      (await createRes.json()).result.content[0].text,
    );
    const postId = created.id;

    // Get by ID
    const getRes = await mcpRequest(
      {
        jsonrpc: "2.0",
        id: 11,
        method: "tools/call",
        params: {
          name: "get_post",
          arguments: { id: postId },
        },
      },
      accessToken,
    );
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(getData.result.isError).toBeUndefined();
    const fetched = JSON.parse(getData.result.content[0].text);
    expect(fetched.id).toBe(postId);
    expect(fetched.slug).toBe(slug);

    // Cleanup
    await mcpRequest(
      {
        jsonrpc: "2.0",
        id: 12,
        method: "tools/call",
        params: { name: "delete_post", arguments: { id: postId } },
      },
      accessToken,
    );
  });

  it("get_post with both id and slug returns error", async () => {
    const res = await mcpRequest(
      {
        jsonrpc: "2.0",
        id: 20,
        method: "tools/call",
        params: {
          name: "get_post",
          arguments: { id: "fake-id", slug: "fake-slug" },
        },
      },
      accessToken,
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.result.isError).toBe(true);
    const text = data.result.content[0].text;
    expect(text).toContain("not both");
  });

  it("list_posts omits content by default (projection)", async () => {
    const slug = `e2e-proj-${Date.now()}`;

    // Create a post with content
    await mcpRequest(
      {
        jsonrpc: "2.0",
        id: 30,
        method: "tools/call",
        params: {
          name: "create_post",
          arguments: {
            title: "E2E Projection Test",
            slug,
            content: "This content should be omitted in list",
            status: "draft",
          },
        },
      },
      accessToken,
    );

    // List posts filtered by query to ensure our post is in the result
    const listRes = await mcpRequest(
      {
        jsonrpc: "2.0",
        id: 31,
        method: "tools/call",
        params: { name: "list_posts", arguments: { query: slug } },
      },
      accessToken,
    );
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    expect(listData.result.isError).toBeUndefined();
    const parsed = JSON.parse(listData.result.content[0].text);

    // Validate paginated response shape: { posts: [...], total: N }
    expect(parsed).toHaveProperty("posts");
    expect(parsed).toHaveProperty("total");
    expect(Array.isArray(parsed.posts)).toBe(true);

    const post = (parsed.posts as Record<string, unknown>[]).find(
      (p) => p.slug === slug,
    );

    // Post MUST be found — fail loudly if not
    expect(post).toBeDefined();

    // content and content_html should be omitted by projection
    expect(post).not.toHaveProperty("content");
    expect(post).not.toHaveProperty("content_html");
    // title and slug should still be present
    expect(post).toHaveProperty("title");
    expect(post).toHaveProperty("slug");

    // Cleanup
    await mcpRequest(
      {
        jsonrpc: "2.0",
        id: 32,
        method: "tools/call",
        params: { name: "delete_post", arguments: { slug } },
      },
      accessToken,
    );
  });

  it("list_posts with include: ['full'] returns all fields", async () => {
    const slug = `e2e-full-${Date.now()}`;
    const contentText = "Full projection content here";

    // Create
    await mcpRequest(
      {
        jsonrpc: "2.0",
        id: 40,
        method: "tools/call",
        params: {
          name: "create_post",
          arguments: {
            title: "E2E Full Projection",
            slug,
            content: contentText,
            status: "draft",
          },
        },
      },
      accessToken,
    );

    // List with include: ["full"] and query filter to find our post
    const listRes = await mcpRequest(
      {
        jsonrpc: "2.0",
        id: 41,
        method: "tools/call",
        params: {
          name: "list_posts",
          arguments: { include: ["full"], query: slug },
        },
      },
      accessToken,
    );
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    expect(listData.result.isError).toBeUndefined();
    const parsed = JSON.parse(listData.result.content[0].text);

    // Validate paginated response shape
    expect(parsed).toHaveProperty("posts");
    expect(Array.isArray(parsed.posts)).toBe(true);

    const post = (parsed.posts as Record<string, unknown>[]).find(
      (p) => p.slug === slug,
    );

    // Post MUST be found — fail loudly if not
    expect(post).toBeDefined();

    // With "full", content should be present
    expect(post).toHaveProperty("content");
    expect(post!.content).toBe(contentText);

    // Cleanup
    await mcpRequest(
      {
        jsonrpc: "2.0",
        id: 42,
        method: "tools/call",
        params: { name: "delete_post", arguments: { slug } },
      },
      accessToken,
    );
  });
});

describe("MCP Admin Token API", () => {
  it("GET /api/mcp/tokens returns token list", async () => {
    const res = await fetch(`${BASE}/api/mcp/tokens`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("POST + DELETE token lifecycle", async () => {
    // Create
    const createRes = await fetch(`${BASE}/api/mcp/tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_name: "e2e-lifecycle" }),
    });
    expect(createRes.status).toBe(201);

    const created = await createRes.json();
    expect(created.access_token).toMatch(/^firefly_at_/);
    expect(created.id).toBeTruthy();

    // Revoke
    const revokeRes = await fetch(
      `${BASE}/api/mcp/tokens/${created.id}`,
      { method: "DELETE" },
    );
    expect(revokeRes.status).toBe(200);

    // Verify token no longer works
    const mcpRes = await fetch(`${BASE}/api/mcp`, {
      method: "POST",
      headers: {
        ...MCP_HEADERS,
        Authorization: `Bearer ${created.access_token}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
      }),
    });
    // Revoked token should be rejected
    expect(mcpRes.status).toBe(401);
  });

  it("DELETE single revoked token permanently", async () => {
    // Create and revoke a token
    const createRes = await fetch(`${BASE}/api/mcp/tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_name: "e2e-delete-single" }),
    });
    const created = await createRes.json();

    // Revoke first
    await fetch(`${BASE}/api/mcp/tokens/${created.id}`, { method: "DELETE" });

    // Permanently delete
    const deleteRes = await fetch(
      `${BASE}/api/mcp/tokens/${created.id}?action=delete`,
      { method: "DELETE" },
    );
    expect(deleteRes.status).toBe(200);
    const deleteData = await deleteRes.json();
    expect(deleteData.action).toBe("deleted");

    // Token should no longer exist in list
    const listRes = await fetch(`${BASE}/api/mcp/tokens`);
    const tokens = await listRes.json();
    const found = tokens.find((t: { id: string }) => t.id === created.id);
    expect(found).toBeUndefined();
  });

  it("DELETE non-revoked token with action=delete fails", async () => {
    // Create a token (not revoked)
    const createRes = await fetch(`${BASE}/api/mcp/tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_name: "e2e-delete-active" }),
    });
    const created = await createRes.json();

    // Try to permanently delete without revoking first
    const deleteRes = await fetch(
      `${BASE}/api/mcp/tokens/${created.id}?action=delete`,
      { method: "DELETE" },
    );
    expect(deleteRes.status).toBe(404);

    // Cleanup: revoke then delete
    await fetch(`${BASE}/api/mcp/tokens/${created.id}`, { method: "DELETE" });
    await fetch(`${BASE}/api/mcp/tokens/${created.id}?action=delete`, { method: "DELETE" });
  });

  it("DELETE /api/mcp/tokens bulk deletes all revoked tokens", async () => {
    // Create and revoke two tokens
    const t1 = await (
      await fetch(`${BASE}/api/mcp/tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_name: "e2e-bulk-1" }),
      })
    ).json();
    const t2 = await (
      await fetch(`${BASE}/api/mcp/tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_name: "e2e-bulk-2" }),
      })
    ).json();

    // Revoke both
    await fetch(`${BASE}/api/mcp/tokens/${t1.id}`, { method: "DELETE" });
    await fetch(`${BASE}/api/mcp/tokens/${t2.id}`, { method: "DELETE" });

    // Bulk delete
    const bulkRes = await fetch(`${BASE}/api/mcp/tokens`, { method: "DELETE" });
    expect(bulkRes.status).toBe(200);
    const bulkData = await bulkRes.json();
    expect(bulkData.deleted).toBeGreaterThanOrEqual(2);

    // Verify tokens are gone
    const listRes = await fetch(`${BASE}/api/mcp/tokens`);
    const tokens = await listRes.json();
    expect(tokens.find((t: { id: string }) => t.id === t1.id)).toBeUndefined();
    expect(tokens.find((t: { id: string }) => t.id === t2.id)).toBeUndefined();
  });

  it("GET /api/mcp/tokens?revoked_count=true returns count", async () => {
    // Create and revoke a token
    const t = await (
      await fetch(`${BASE}/api/mcp/tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_name: "e2e-count" }),
      })
    ).json();
    await fetch(`${BASE}/api/mcp/tokens/${t.id}`, { method: "DELETE" });

    // Check count
    const countRes = await fetch(`${BASE}/api/mcp/tokens?revoked_count=true`);
    expect(countRes.status).toBe(200);
    const countData = await countRes.json();
    expect(countData.revoked_count).toBeGreaterThanOrEqual(1);

    // Cleanup
    await fetch(`${BASE}/api/mcp/tokens/${t.id}?action=delete`, { method: "DELETE" });
  });
});

// ---------------------------------------------------------------------------
// MCP OAuth Flow — /api/mcp/authorize (error paths)
// ---------------------------------------------------------------------------

describe("MCP OAuth Authorize — Error Paths", () => {
  it("returns 400 when missing required parameters", async () => {
    const res = await fetch(`${BASE}/api/mcp/authorize`, {
      redirect: "manual",
    });
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain("Missing required parameters");
  });

  it("returns 400 when response_type is not 'code'", async () => {
    const params = new URLSearchParams({
      response_type: "token",
      client_id: "test_client",
      redirect_uri: "http://localhost:9999/callback",
      code_challenge: "test_challenge",
      code_challenge_method: "S256",
      state: "test_state",
    });

    const res = await fetch(`${BASE}/api/mcp/authorize?${params}`, {
      redirect: "manual",
    });
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain("response_type must be 'code'");
  });

  it("returns 400 when code_challenge_method is not 'S256'", async () => {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: "test_client",
      redirect_uri: "http://localhost:9999/callback",
      code_challenge: "test_challenge",
      code_challenge_method: "plain",
      state: "test_state",
    });

    const res = await fetch(`${BASE}/api/mcp/authorize?${params}`, {
      redirect: "manual",
    });
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain("code_challenge_method must be 'S256'");
  });

  it("returns 400 when scope is invalid", async () => {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: "test_client",
      redirect_uri: "http://localhost:9999/callback",
      code_challenge: "test_challenge",
      code_challenge_method: "S256",
      state: "test_state",
      scope: "invalid_scope",
    });

    const res = await fetch(`${BASE}/api/mcp/authorize?${params}`, {
      redirect: "manual",
    });
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain("Invalid scope");
  });

  it("returns 401 when client_id is unknown", async () => {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: "nonexistent_client_xyz",
      redirect_uri: "http://localhost:9999/callback",
      code_challenge: "test_challenge",
      code_challenge_method: "S256",
      state: "test_state",
    });

    const res = await fetch(`${BASE}/api/mcp/authorize?${params}`, {
      redirect: "manual",
    });
    expect(res.status).toBe(401);

    const data = await res.json();
    expect(data.error).toContain("Unknown client_id");
  });

  it("returns 400 when redirect_uri does not match registered URIs", async () => {
    // First register a client
    const registerRes = await fetch(`${BASE}/api/mcp/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_name: "E2E Redirect Test",
        redirect_uris: ["http://localhost:9999/callback"],
      }),
    });
    const client = await registerRes.json();

    // Try to authorize with a different redirect_uri
    const params = new URLSearchParams({
      response_type: "code",
      client_id: client.client_id,
      redirect_uri: "http://localhost:8888/different",
      code_challenge: "test_challenge",
      code_challenge_method: "S256",
      state: "test_state",
    });

    const res = await fetch(`${BASE}/api/mcp/authorize?${params}`, {
      redirect: "manual",
    });
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain("redirect_uri does not match");
  });
});

// ---------------------------------------------------------------------------
// MCP OAuth Callback — /api/mcp/callback (error paths)
// ---------------------------------------------------------------------------

describe("MCP OAuth Callback — Error Paths", () => {
  it("returns 400 when state is missing", async () => {
    const res = await fetch(`${BASE}/api/mcp/callback`, {
      redirect: "manual",
    });
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain("Missing state parameter");
  });

  it("returns 401 when not authenticated", async () => {
    // Note: In E2E_SKIP_AUTH mode, this may behave differently.
    // We're testing the state validation path here.
    const res = await fetch(`${BASE}/api/mcp/callback?state=invalid_state_xyz`, {
      redirect: "manual",
    });

    // Could be 401 (no auth) or 400 (invalid state) depending on E2E config
    expect([400, 401]).toContain(res.status);
  });
});
