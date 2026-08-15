import { getDb } from "@/lib/db";
import { listCategories } from "@/data/entities/category";
import { listTags } from "@/data/entities/tag";
import { listHumans } from "@/data/entities/human";
import { listAiAgents } from "@/data/entities/ai-agent";
import { getDefaultHumanIdUncached } from "@/data/entities/human";
import { PostForm } from "@/components/admin/post-form";

export default async function NewPostPage() {
  const db = getDb();
  const [categories, tags, humans, agents, defaultHumanId] = await Promise.all([
    listCategories(db),
    listTags(db),
    listHumans(db),
    listAiAgents(db),
    getDefaultHumanIdUncached(db),
  ]);

  return (
    <PostForm
      categories={categories}
      tags={tags}
      humans={humans}
      agents={agents}
      defaultHumanId={defaultHumanId}
    />
  );
}
