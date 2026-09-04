import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { listTags } from "@/data/entities/tag";
import { TaxonomyManager } from "@/components/admin/taxonomy-manager";

export const metadata: Metadata = {
  title: "标签",
};

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
