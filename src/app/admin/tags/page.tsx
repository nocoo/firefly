import { getDb } from "@/lib/db";
import { listTags } from "@/data/tags";
import { TaxonomyManager } from "@/components/admin/taxonomy-manager";

export default async function AdminTagsPage() {
  const db = getDb();
  const tags = await listTags(db);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Tags</h2>
        <p className="text-sm text-muted-foreground">
          {tags.length} tag{tags.length !== 1 ? "s" : ""} total
        </p>
      </div>
      <TaxonomyManager
        type="tag"
        items={tags}
        apiBase="/api/tags"
      />
    </div>
  );
}
