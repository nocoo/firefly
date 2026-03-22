import { getDb } from "@/lib/db";
import { listCategories } from "@/data/categories";
import { TaxonomyManager } from "@/components/admin/taxonomy-manager";

export default async function AdminCategoriesPage() {
  const db = getDb();
  const categories = await listCategories(db);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Categories</h2>
        <p className="text-sm text-muted-foreground">
          {categories.length} categor{categories.length !== 1 ? "ies" : "y"}{" "}
          total
        </p>
      </div>
      <TaxonomyManager
        type="category"
        items={categories}
        apiBase="/api/categories"
      />
    </div>
  );
}
