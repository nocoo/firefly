import { getDb } from "@/lib/db";
import { AnalyticsDashboard } from "@/components/admin/analytics-dashboard";

export default async function AdminDashboardPage() {
  const db = getDb();

  const [postCount, categoryCount, tagCount] = await Promise.all([
    db
      .firstOrNull<{ count: number }>(
        "SELECT COUNT(*) as count FROM posts WHERE status = 'published'",
      )
      .then((r) => r?.count ?? 0),
    db
      .firstOrNull<{ count: number }>(
        "SELECT COUNT(*) as count FROM categories",
      )
      .then((r) => r?.count ?? 0),
    db
      .firstOrNull<{ count: number }>("SELECT COUNT(*) as count FROM tags")
      .then((r) => r?.count ?? 0),
  ]);

  return (
    <AnalyticsDashboard
      contentStats={{ postCount, categoryCount, tagCount }}
    />
  );
}
