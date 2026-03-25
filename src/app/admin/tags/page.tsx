import { getDb } from "@/lib/db";
import { listTags } from "@/data/tags";
import { TaxonomyManager } from "@/components/admin/taxonomy-manager";

export default async function AdminTagsPage() {
  const db = getDb();
  const tags = await listTags(db);

  return (
    <TaxonomyManager
      type="tag"
      items={tags}
      apiBase="/api/tags"
    />
  );
}
