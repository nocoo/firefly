import { getDb } from "@/lib/db";
import { getLocale } from "@/i18n/server";
import { t } from "@/i18n/translations";

export default async function AdminDashboardPage() {
  const db = getDb();
  const locale = await getLocale();

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
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t(locale, "admin.dashboard.overview")}</h2>
        <p className="text-sm text-muted-foreground">
          {t(locale, "admin.dashboard.summary")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t(locale, "admin.dashboard.publishedPosts")} value={postCount} />
        <StatCard label={t(locale, "admin.dashboard.categories")} value={categoryCount} />
        <StatCard label={t(locale, "admin.dashboard.tags")} value={tagCount} />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius-widget)] bg-secondary p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
