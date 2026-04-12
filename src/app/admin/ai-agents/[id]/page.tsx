import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getAiAgentById } from "@/data/entities/ai-agent";
import { listCategories } from "@/data/entities/category";
import { AiAgentForm } from "@/components/admin/ai-agent-form";
import { getAgentAvatarUrl } from "@/lib/ai-agent/avatar";

interface AiAgentEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function AiAgentEditPage({
  params,
}: AiAgentEditPageProps) {
  const { id } = await params;
  const db = getDb();
  const isNew = id === "new";

  const [agent, categories] = await Promise.all([
    isNew ? null : getAiAgentById(db, id),
    listCategories(db),
  ]);

  if (!isNew && !agent) notFound();

  // Pre-compute avatar URL on server (getAgentAvatarUrl is server-only)
  // Use agent.id (not slug) for stable paths that survive slug changes
  const avatarUrl = agent
    ? getAgentAvatarUrl(agent.id, agent.avatar_version, 128)
    : null;

  return (
    <AiAgentForm
      agent={agent}
      categories={categories}
      initialAvatarUrl={avatarUrl}
    />
  );
}
