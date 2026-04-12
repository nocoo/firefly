// ---------------------------------------------------------------------------
// AI Agent entity — CRUD + API key management
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";
import type { AiAgent, AiAgentWithCategory } from "@/models/types";
import { nowEpoch } from "@/data/core/timestamps";
import { randomHex, sha256 } from "@/data/mcp-tokens";
import { ulid } from "ulid";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_KEY_PREFIX = "firefly_agent_";

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
  isActive?: boolean;
}

// ---------------------------------------------------------------------------
// API key generation
// ---------------------------------------------------------------------------

/**
 * Generate a new agent API key.
 * Returns plaintext (for one-time display), hash (for storage), and preview (last 8 chars).
 */
export async function generateAgentApiKey(): Promise<{
  plaintext: string;
  hash: string;
  preview: string;
}> {
  const random = randomHex(24); // 48 hex chars
  const plaintext = `${API_KEY_PREFIX}${random}`;
  const hash = await sha256(plaintext);
  const preview = plaintext.slice(-8); // Last 8 chars for identification
  return { plaintext, hash, preview };
}

// ---------------------------------------------------------------------------
// createAiAgent
// ---------------------------------------------------------------------------

export interface CreateAiAgentResult {
  agent: AiAgent;
  plaintextKey: string;
}

export async function createAiAgent(
  db: Db,
  input: CreateAiAgentInput,
): Promise<CreateAiAgentResult> {
  const id = ulid();
  const now = nowEpoch();
  const { plaintext, hash, preview } = await generateAgentApiKey();

  const sql = `
    INSERT INTO ai_agents
      (id, name, slug, description, category_id, api_key_hash, api_key_preview,
       avatar_version, is_active, last_used_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 1, NULL, ?, ?)
  `;

  await db.execute(sql, [
    id,
    input.name,
    input.slug,
    input.description ?? null,
    input.categoryId,
    hash,
    preview,
    now,
    now,
  ]);

  const agent = await getAiAgentById(db, id);
  if (!agent) throw new Error(`Failed to retrieve ai_agent ${id} after creation`);
  return { agent, plaintextKey: plaintext };
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
// getAiAgentByApiKey
// ---------------------------------------------------------------------------

/**
 * Validate an API key and return the agent if valid.
 * Updates last_used_at on successful validation.
 * Returns null if key is invalid or agent is disabled.
 */
export async function getAiAgentByApiKey(
  db: Db,
  plaintextKey: string,
): Promise<AiAgent | null> {
  // Quick prefix check
  if (!plaintextKey.startsWith(API_KEY_PREFIX)) return null;

  const hash = await sha256(plaintextKey);
  const agent = await db.firstOrNull<AiAgent>(
    "SELECT * FROM ai_agents WHERE api_key_hash = ? AND is_active = 1",
    [hash],
  );

  if (!agent) return null;

  // Update last_used_at
  const now = nowEpoch();
  await db.execute(
    "UPDATE ai_agents SET last_used_at = ? WHERE id = ?",
    [now, agent.id],
  );

  return agent;
}

// ---------------------------------------------------------------------------
// listAiAgents
// ---------------------------------------------------------------------------

export interface ListAiAgentsOptions {
  includeInactive?: boolean;
}

/**
 * List all agents with category info and post count.
 * By default excludes inactive agents.
 */
export async function listAiAgents(
  db: Db,
  opts?: ListAiAgentsOptions,
): Promise<AiAgentWithCategory[]> {
  const includeInactive = opts?.includeInactive ?? false;
  const whereClause = includeInactive ? "" : "WHERE a.is_active = 1";

  const sql = `
    SELECT
      a.*,
      c.name AS category_name,
      c.slug AS category_slug,
      (SELECT COUNT(*) FROM posts p WHERE p.ai_agent_id = a.id) AS post_count
    FROM ai_agents a
    JOIN categories c ON a.category_id = c.id
    ${whereClause}
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
  if (input.isActive !== undefined) {
    sets.push("is_active = ?");
    params.push(input.isActive ? 1 : 0);
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
// regenerateAgentApiKey
// ---------------------------------------------------------------------------

export interface RegenerateKeyResult {
  agent: AiAgent;
  plaintextKey: string;
}

/**
 * Generate a new API key for an agent.
 * Old key is immediately invalidated.
 */
export async function regenerateAgentApiKey(
  db: Db,
  id: string,
): Promise<RegenerateKeyResult | null> {
  const agent = await getAiAgentById(db, id);
  if (!agent) return null;

  const { plaintext, hash, preview } = await generateAgentApiKey();
  const now = nowEpoch();

  await db.execute(
    `UPDATE ai_agents SET api_key_hash = ?, api_key_preview = ?, updated_at = ? WHERE id = ?`,
    [hash, preview, now, id],
  );

  const updated = await getAiAgentById(db, id);
  if (!updated) throw new Error(`Failed to retrieve ai_agent ${id} after key regeneration`);
  return { agent: updated, plaintextKey: plaintext };
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
