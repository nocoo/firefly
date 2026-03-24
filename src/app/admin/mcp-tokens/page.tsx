import { getDb } from "@/lib/db";
import { listMcpTokens } from "@/data/mcp-tokens";
import { McpTokensManager } from "@/components/admin/mcp-tokens-manager";

export default async function McpTokensPage() {
  const db = getDb();
  const tokens = await listMcpTokens(db);

  return <McpTokensManager tokens={tokens} />;
}
