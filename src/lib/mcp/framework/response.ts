// ---------------------------------------------------------------------------
// Entity-Driven MCP Framework — MCP Response Builders
// ---------------------------------------------------------------------------

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/** Build a successful MCP tool response with JSON-serialized data. */
export function ok(data: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

/** Build an error MCP tool response. */
export function error(message: string): CallToolResult {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}
