import { getDb } from "@/lib/db";
import { listCategoriesWithPostStats } from "@/data/entities/category";
import { TaxonomyManager } from "@/components/admin/taxonomy-manager";

export default async function AdminCategoriesPage() {
  const db = getDb();
  const categories = await listCategoriesWithPostStats(db);

  return (
    <TaxonomyManager
      type="category"
      items={categories}
      apiBase="/api/categories"
    />
  );
}
