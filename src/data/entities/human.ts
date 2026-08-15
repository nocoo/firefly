import type { Db } from "@/lib/db";
import type { Human, HumanWithMeta } from "@/models/types";
import { nowEpoch, newId } from "@/data/core/timestamps";

export interface CreateHumanInput {
  name: string;
  slug: string;
  description?: string | null;
  email?: string | null;
  profilePublic?: boolean;
}

export interface UpdateHumanInput {
  name?: string;
  slug?: string;
  description?: string | null;
  email?: string | null;
  profilePublic?: boolean;
}

export function normalizeHumanEmail(email: string | null | undefined): string | null {
  if (email == null) return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed.length === 0 ? null : trimmed;
}

export async function createHuman(
  db: Db,
  input: CreateHumanInput,
): Promise<Human> {
  const id = newId();
  const now = nowEpoch();
  const email = normalizeHumanEmail(input.email ?? null);

  await db.execute(
    `INSERT INTO humans
      (id, name, slug, description, email, profile_public, avatar_version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    [
      id,
      input.name,
      input.slug,
      input.description ?? null,
      email,
      input.profilePublic ? 1 : 0,
      now,
      now,
    ],
  );

  const human = await getHumanById(db, id);
  if (!human) throw new Error(`Failed to retrieve human ${id} after creation`);
  return human;
}

export async function getHumanById(db: Db, id: string): Promise<Human | null> {
  return db.firstOrNull<Human>("SELECT * FROM humans WHERE id = ?", [id]);
}

export async function getHumanBySlug(
  db: Db,
  slug: string,
): Promise<Human | null> {
  return db.firstOrNull<Human>("SELECT * FROM humans WHERE slug = ?", [slug]);
}

export async function getHumanByEmail(
  db: Db,
  email: string,
): Promise<Human | null> {
  const normalized = normalizeHumanEmail(email);
  if (!normalized) return null;
  return db.firstOrNull<Human>("SELECT * FROM humans WHERE email = ?", [
    normalized,
  ]);
}

export async function listHumans(db: Db): Promise<HumanWithMeta[]> {
  const sql = `
    SELECT
      h.*,
      (SELECT COUNT(*) FROM posts p WHERE p.human_id = h.id) AS post_count,
      CASE WHEN s.default_human_id = h.id THEN 1 ELSE 0 END AS is_default
    FROM humans h
    LEFT JOIN site_settings s ON s.id = 1
    ORDER BY h.name ASC
  `;
  const result = await db.query<HumanWithMeta>(sql);
  return result.results;
}

export async function updateHuman(
  db: Db,
  id: string,
  input: UpdateHumanInput,
): Promise<Human | null> {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (input.name !== undefined) {
    sets.push("name = ?");
    params.push(input.name);
  }
  if (input.slug !== undefined) {
    sets.push("slug = ?");
    params.push(input.slug);
  }
  if (input.description !== undefined) {
    sets.push("description = ?");
    params.push(input.description);
  }
  if (input.email !== undefined) {
    sets.push("email = ?");
    params.push(normalizeHumanEmail(input.email));
  }
  if (input.profilePublic !== undefined) {
    sets.push("profile_public = ?");
    params.push(input.profilePublic ? 1 : 0);
  }

  if (sets.length === 0) {
    return getHumanById(db, id);
  }

  sets.push("updated_at = ?");
  params.push(nowEpoch());
  params.push(id);

  await db.execute(
    `UPDATE humans SET ${sets.join(", ")} WHERE id = ?`,
    params,
  );
  return getHumanById(db, id);
}

export async function updateHumanAvatarVersion(
  db: Db,
  id: string,
  version: string | null,
): Promise<void> {
  await db.execute(
    "UPDATE humans SET avatar_version = ?, updated_at = ? WHERE id = ?",
    [version, nowEpoch(), id],
  );
}

export async function getHumanPostCount(db: Db, humanId: string): Promise<number> {
  const result = await db.firstOrNull<{ count: number }>(
    "SELECT COUNT(*) AS count FROM posts WHERE human_id = ?",
    [humanId],
  );
  return result?.count ?? 0;
}

export async function countHumans(db: Db): Promise<number> {
  const result = await db.firstOrNull<{ count: number }>(
    "SELECT COUNT(*) AS count FROM humans",
  );
  return result?.count ?? 0;
}

export interface DeleteHumanResult {
  success: boolean;
  reason?: "not_found" | "has_posts" | "is_default" | "last_human";
  postCount?: number;
}

export async function deleteHuman(
  db: Db,
  id: string,
): Promise<DeleteHumanResult> {
  const existing = await getHumanById(db, id);
  if (!existing) return { success: false, reason: "not_found" };

  const total = await countHumans(db);
  if (total <= 1) return { success: false, reason: "last_human" };

  const defaultId = await getDefaultHumanIdUncached(db);
  if (defaultId === id) return { success: false, reason: "is_default" };

  const postCount = await getHumanPostCount(db, id);
  if (postCount > 0) return { success: false, reason: "has_posts", postCount };

  const meta = await db.execute("DELETE FROM humans WHERE id = ?", [id]);
  return { success: meta.changes > 0 };
}

export async function getDefaultHumanIdUncached(db: Db): Promise<string | null> {
  const row = await db.firstOrNull<{ default_human_id: string | null }>(
    "SELECT default_human_id FROM site_settings WHERE id = 1",
  );
  return row?.default_human_id ?? null;
}

export async function getDefaultHuman(db: Db): Promise<Human | null> {
  const id = await getDefaultHumanIdUncached(db);
  if (!id) return null;
  return getHumanById(db, id);
}

export async function listPublicHumans(db: Db): Promise<Human[]> {
  const result = await db.query<Human>(
    "SELECT * FROM humans WHERE profile_public = 1 AND email IS NOT NULL",
  );
  return result.results;
}
