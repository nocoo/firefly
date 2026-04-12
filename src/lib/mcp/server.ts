// ---------------------------------------------------------------------------
// MCP Server — entity-driven tool registration
// ---------------------------------------------------------------------------

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { APP_VERSION } from "@/lib/version";
import type { Db } from "@/lib/db";
import type { AiAgent } from "@/models/types";
import type { ToolContext } from "./framework/types";
import { registerEntityTools } from "./framework/register";
import { tagEntity } from "./entities/tag";
import { categoryEntity } from "./entities/category";
import { postEntity } from "./entities/post";
import { createAgentPostEntity } from "./entities/agent-post";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface McpServerContext {
  type: "oauth" | "agent";
  agent?: AiAgent;
}

// ---------------------------------------------------------------------------
// Server Factory
// ---------------------------------------------------------------------------

/**
 * Create a new McpServer instance with tools registered based on context.
 *
 * - OAuth context (default): Full access to all entity tools (tag, category, post)
 * - Agent context: Only constrained post tools scoped to agent's category
 */
export function createMcpServer(db: Db, context?: McpServerContext): McpServer {
  const server = new McpServer({ name: "firefly", version: APP_VERSION });
  const ctx: ToolContext = { db };

  // Agent context: only register constrained post tools
  if (context?.type === "agent" && context.agent) {
    const agentPostEntity = createAgentPostEntity(context.agent);
    registerEntityTools(server, agentPostEntity, ctx);
    // No tag/category tools for agents
    return server;
  }

  // OAuth context (default): register all tools
  registerEntityTools(server, tagEntity, ctx);
  registerEntityTools(server, categoryEntity, ctx);
  registerEntityTools(server, postEntity, ctx);

  return server;
}
