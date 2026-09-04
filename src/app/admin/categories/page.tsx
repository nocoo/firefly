import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { listCategoriesWithPostStats } from "@/data/entities/category";
import { TaxonomyManager } from "@/components/admin/taxonomy-manager";

export const metadata: Metadata = {
  title: "分类",
};

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
