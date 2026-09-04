import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { listMcpTokens } from "@/data/mcp-tokens";
import { McpTokensManager } from "@/components/admin/mcp-tokens-manager";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "MCP 令牌",
};

export default async function McpTokensPage() {
  const db = getDb();
  const tokens = await listMcpTokens(db);
  const mcpUrl = `${SITE_URL}/api/mcp`;

  return <McpTokensManager tokens={tokens} mcpUrl={mcpUrl} />;
}
