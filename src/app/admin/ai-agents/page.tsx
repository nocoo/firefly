import { getDb } from "@/lib/db";
import { listAiAgents } from "@/data/entities/ai-agent";
import { listCategories } from "@/data/entities/category";
import { AiAgentsManager } from "@/components/admin/ai-agents-manager";
import { SITE_URL } from "@/lib/seo";

export default async function AiAgentsPage() {
  const db = getDb();
  const [agents, categories] = await Promise.all([
    listAiAgents(db, { includeInactive: true }),
    listCategories(db),
  ]);
  const mcpUrl = `${SITE_URL}/api/mcp`;

  return (
    <AiAgentsManager
      agents={agents}
      categories={categories}
      mcpUrl={mcpUrl}
    />
  );
}
