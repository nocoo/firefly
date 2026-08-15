import { getDb } from "@/lib/db";
import { listHumans } from "@/data/entities/human";
import { getHumanAvatarUrl } from "@/lib/human-avatar";
import { AuthorsManager } from "@/components/admin/authors-manager";

export default async function AuthorsPage() {
  const db = getDb();
  const authors = await listHumans(db);
  const authorsWithAvatarUrls = authors.map((author) => ({
    ...author,
    avatarUrl: getHumanAvatarUrl(author.id, author.avatar_version, 64),
  }));

  return <AuthorsManager authors={authorsWithAvatarUrls} />;
}
