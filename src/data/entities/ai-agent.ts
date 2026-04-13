// ---------------------------------------------------------------------------
// AI Agent entity — pure identity records for AI writing
// No independent authentication — all access via OAuth tokens
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";
import type { AiAgent, AiAgentWithCategory } from "@/models/types";
import { nowEpoch } from "@/data/core/timestamps";
import { ulid } from "ulid";

// ---------------------------------------------------------------------------
// Input types (camelCase)
// ---------------------------------------------------------------------------

export interface CreateAiAgentInput {
  name: string;
  slug: string;
  description?: string | null;
  categoryId: string;
}

export interface UpdateAiAgentInput {
  name?: string;
  slug?: string;
  description?: string | null;
}

// ---------------------------------------------------------------------------
// createAiAgent
// ---------------------------------------------------------------------------

export async function createAiAgent(
  db: Db,
  input: CreateAiAgentInput,
): Promise<AiAgent> {
  const id = ulid();
  const now = nowEpoch();

  const sql = `
    INSERT INTO ai_agents
      (id, name, slug, description, category_id, avatar_version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
  `;

  await db.execute(sql, [
    id,
    input.name,
    input.slug,
    input.description ?? null,
    input.categoryId,
    now,
    now,
  ]);

  const agent = await getAiAgentById(db, id);
  if (!agent) throw new Error(`Failed to retrieve ai_agent ${id} after creation`);
  return agent;
}

// ---------------------------------------------------------------------------
// getAiAgentById
// ---------------------------------------------------------------------------

export async function getAiAgentById(
  db: Db,
  id: string,
): Promise<AiAgent | null> {
  return db.firstOrNull<AiAgent>(
    "SELECT * FROM ai_agents WHERE id = ?",
    [id],
  );
}

// ---------------------------------------------------------------------------
// getAiAgentBySlug
// ---------------------------------------------------------------------------

export async function getAiAgentBySlug(
  db: Db,
  slug: string,
): Promise<AiAgent | null> {
  return db.firstOrNull<AiAgent>(
    "SELECT * FROM ai_agents WHERE slug = ?",
    [slug],
  );
}

// ---------------------------------------------------------------------------
// listAiAgents
// ---------------------------------------------------------------------------

/**
 * List all agents with category info and post count.
 */
export async function listAiAgents(
  db: Db,
): Promise<AiAgentWithCategory[]> {
  const sql = `
    SELECT
      a.*,
      c.name AS category_name,
      c.slug AS category_slug,
      (SELECT COUNT(*) FROM posts p WHERE p.ai_agent_id = a.id) AS post_count
    FROM ai_agents a
    JOIN categories c ON a.category_id = c.id
    ORDER BY a.name ASC
  `;

  const result = await db.query<AiAgentWithCategory>(sql);
  return result.results;
}

// ---------------------------------------------------------------------------
// updateAiAgent
// ---------------------------------------------------------------------------

export async function updateAiAgent(
  db: Db,
  id: string,
  input: UpdateAiAgentInput,
): Promise<AiAgent | null> {
  // Build dynamic SET clause
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

  if (sets.length === 0) {
    return getAiAgentById(db, id);
  }

  sets.push("updated_at = ?");
  params.push(nowEpoch());
  params.push(id);

  await db.execute(
    `UPDATE ai_agents SET ${sets.join(", ")} WHERE id = ?`,
    params,
  );

  return getAiAgentById(db, id);
}

// ---------------------------------------------------------------------------
// updateAvatarVersion
// ---------------------------------------------------------------------------

/**
 * Update avatar version (called after successful avatar upload).
 */
export async function updateAvatarVersion(
  db: Db,
  id: string,
  version: string | null,
): Promise<void> {
  const now = nowEpoch();
  await db.execute(
    "UPDATE ai_agents SET avatar_version = ?, updated_at = ? WHERE id = ?",
    [version, now, id],
  );
}

// ---------------------------------------------------------------------------
// getAiAgentPostCount
// ---------------------------------------------------------------------------

/**
 * Get the number of posts authored by an agent.
 * Used to determine if an agent can be deleted (must have 0 posts).
 */
export async function getAiAgentPostCount(
  db: Db,
  agentId: string,
): Promise<number> {
  const result = await db.firstOrNull<{ count: number }>(
    "SELECT COUNT(*) AS count FROM posts WHERE ai_agent_id = ?",
    [agentId],
  );
  return result?.count ?? 0;
}

// ---------------------------------------------------------------------------
// deleteAiAgent
// ---------------------------------------------------------------------------

export interface DeleteAiAgentResult {
  success: boolean;
  /** Number of posts still referencing this agent (if deletion was blocked) */
  postCount?: number;
}

/**
 * Delete an AI agent.
 *
 * Deletion is BLOCKED if the agent has any posts referencing it (ai_agent_id).
 * This prevents silently orphaning published articles or changing their authorship.
 * To delete an agent with posts, first reassign or delete those posts.
 *
 * @returns success=true if deleted, success=false with postCount if blocked
 */
export async function deleteAiAgent(
  db: Db,
  id: string,
): Promise<DeleteAiAgentResult> {
  // Check if any posts reference this agent
  const countResult = await db.firstOrNull<{ count: number }>(
    "SELECT COUNT(*) AS count FROM posts WHERE ai_agent_id = ?",
    [id],
  );
  const postCount = countResult?.count ?? 0;

  if (postCount > 0) {
    return { success: false, postCount };
  }

  const meta = await db.execute(
    "DELETE FROM ai_agents WHERE id = ?",
    [id],
  );
  return { success: meta.changes > 0 };
}
