import pkg from "../../../../../package.json";

/**
 * MCP Server Card endpoint (SEP-1649).
 *
 * Advertises this server's MCP capabilities and transport so that clients
 * can discover the MCP endpoint without prior configuration.
 *
 * Spec: https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2127
 */
export function GET() {
  const body = {
    serverInfo: {
      name: "firefly",
      version: pkg.version,
    },
    transport: {
      type: "streamable-http",
      endpoint: "/api/mcp",
    },
    capabilities: {
      tools: true,
      resources: true,
      prompts: false,
    },
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
