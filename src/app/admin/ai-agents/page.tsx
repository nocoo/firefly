import { getDb } from "@/lib/db";
import { listAiAgents } from "@/data/entities/ai-agent";
import { listCategories } from "@/data/entities/category";
import { AiAgentsManager } from "@/components/admin/ai-agents-manager";
import { SITE_URL } from "@/lib/seo";
import { getAgentAvatarUrl } from "@/lib/ai-agent/avatar";

export default async function AiAgentsPage() {
  const db = getDb();
  const [agents, categories] = await Promise.all([
    listAiAgents(db),
    listCategories(db),
  ]);
  const mcpUrl = `${SITE_URL}/api/mcp`;

  // Pre-compute avatar URLs on the server (getAgentAvatarUrl is server-only)
  // Use agent.id (not slug) for stable paths that survive slug changes
  const agentsWithAvatarUrls = agents.map((agent) => ({
    ...agent,
    avatarUrl: getAgentAvatarUrl(agent.id, agent.avatar_version, 64),
  }));

  return (
    <AiAgentsManager
      agents={agentsWithAvatarUrls}
      categories={categories}
      mcpUrl={mcpUrl}
    />
  );
}
