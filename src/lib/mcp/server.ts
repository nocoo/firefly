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
import { createAuthorPostEntity } from "./entities/author-post";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface McpServerContext {
  /** "full" = admin access, "author" = AI writing mode with author_id requirement */
  type: "full" | "author";
  /** User email from the OAuth token */
  userEmail: string;
}

// ---------------------------------------------------------------------------
// Server Factory
// ---------------------------------------------------------------------------

/**
 * Create a new McpServer instance with tools registered based on context.
 *
 * - Full scope: Full access to all entity tools (tag, category, post)
 * - Author scope: Only constrained post tools that require author_id
 */
export function createMcpServer(db: Db, context?: McpServerContext): McpServer {
  const server = new McpServer({ name: "firefly", version: APP_VERSION });
  const ctx: ToolContext = { db };

  // Author scope: constrained post tools (require author_id) + full tag CRUD
  if (context?.type === "author") {
    const authorPostEntity = createAuthorPostEntity();
    registerEntityTools(server, authorPostEntity, ctx);
    registerEntityTools(server, tagEntity, ctx);  // Tags are global, no author constraint
    return server;
  }

  // Full scope (default): register all tools
  registerEntityTools(server, tagEntity, ctx);
  registerEntityTools(server, categoryEntity, ctx);
  registerEntityTools(server, postEntity, ctx);

  return server;
}
