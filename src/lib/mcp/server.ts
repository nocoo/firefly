// ---------------------------------------------------------------------------
// MCP Server — entity-driven tool registration
// ---------------------------------------------------------------------------

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { APP_VERSION } from "@/lib/version";
import type { Db } from "@/lib/db";
import type { ToolContext } from "./framework/types";
import { registerEntityTools } from "./framework/register";
import { tagEntity } from "./entities/tag";
import { categoryEntity } from "./entities/category";
import { postEntity } from "./entities/post";

/** Create a new McpServer instance with all tools registered. */
export function createMcpServer(db: Db): McpServer {
  const server = new McpServer({ name: "firefly", version: APP_VERSION });
  const ctx: ToolContext = { db };

  registerEntityTools(server, tagEntity, ctx);
  registerEntityTools(server, categoryEntity, ctx);
  registerEntityTools(server, postEntity, ctx);

  return server;
}
