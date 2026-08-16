import { getDb } from "@/lib/db";
import { listHumans, normalizeHumanEmail } from "@/data/entities/human";
import { getHumanAvatarUrl } from "@/lib/human-avatar";
import { hashNormalizedEmail } from "@/lib/human-profile";
import { SITE_URL } from "@/lib/seo";
import { AuthorsManager } from "@/components/admin/authors-manager";

export default async function AuthorsPage() {
  const db = getDb();
  const authors = await listHumans(db);
  const authorsWithAvatarUrls = authors.map((author) => {
    const email = normalizeHumanEmail(author.email);
    return {
      ...author,
      avatarUrl: getHumanAvatarUrl(author.id, author.avatar_version, 64),
      emailHash: email ? hashNormalizedEmail(email) : null,
    };
  });

  return (
    <AuthorsManager authors={authorsWithAvatarUrls} siteUrl={SITE_URL} />
  );
}
