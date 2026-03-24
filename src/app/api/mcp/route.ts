import { getDb } from "@/lib/db";
import { errorResponse } from "@/lib/api";
import { validateMcpToken, validateOrigin } from "@/lib/mcp/auth";
import { createMcpServer } from "@/lib/mcp/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

export async function POST(request: Request) {
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

  // Step 3: Create MCP server and handle request via stateless transport
  const server = createMcpServer(db);
  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true, // JSON-only, no SSE — stateless Phase 1
  });

  try {
    await server.connect(transport);
    return await transport.handleRequest(request);
  } finally {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  }
}

export function GET() {
  return errorResponse("SSE not supported in Phase 1. Use POST for MCP requests.", 405);
}

export function DELETE() {
  return errorResponse("Session termination not supported in Phase 1.", 405);
}
