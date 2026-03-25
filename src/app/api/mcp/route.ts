import { getDb } from "@/lib/db";
import { errorResponse } from "@/lib/api";
import { validateMcpToken, validateOrigin } from "@/lib/mcp/auth";
import { createMcpServer } from "@/lib/mcp/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

/**
 * Shared handler for all MCP methods.
 *
 * The MCP SDK's WebStandardStreamableHTTPServerTransport.handleRequest()
 * already routes by HTTP method internally:
 *   POST  → JSON-RPC messages (Streamable HTTP)
 *   GET   → SSE stream (legacy SSE transport fallback)
 *   DELETE → session termination (stateful mode)
 */
async function handleMcp(request: Request) {
  const siteUrl = process.env.AUTH_URL ?? "http://localhost:3000";

  // Step 1: Validate Origin header (DNS rebinding prevention)
  const originError = validateOrigin(
    request.headers.get("origin"),
    siteUrl,
  );
  if (originError) {
    return errorResponse(originError.error, originError.status);
  }

  // Step 2: Validate Bearer token
  const db = getDb();
  const authResult = await validateMcpToken(
    db,
    request.headers.get("authorization"),
  );
  if (!authResult.valid) {
    return errorResponse(authResult.error, authResult.status);
  }

  // Step 3: Create MCP server and handle request via transport
  const server = createMcpServer(db);
  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    return await transport.handleRequest(request);
  } finally {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  }
}

export async function POST(request: Request) {
  return handleMcp(request);
}

export async function GET(request: Request) {
  return handleMcp(request);
}

export async function DELETE(request: Request) {
  return handleMcp(request);
}
