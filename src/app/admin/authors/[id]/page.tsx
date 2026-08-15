import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getHumanById } from "@/data/entities/human";
import { getHumanAvatarUrl } from "@/lib/human-avatar";
import { AuthorForm } from "@/components/admin/author-form";

interface AuthorEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function AuthorEditPage({ params }: AuthorEditPageProps) {
  const { id } = await params;
  const db = getDb();
  const isNew = id === "new";
  const author = isNew ? null : await getHumanById(db, id);

  if (!isNew && !author) notFound();

  const avatarUrl = author
    ? getHumanAvatarUrl(author.id, author.avatar_version, 80)
    : null;

  return <AuthorForm author={author} initialAvatarUrl={avatarUrl} />;
}
