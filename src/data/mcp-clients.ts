// ---------------------------------------------------------------------------
// MCP Client data layer — CRUD for dynamic client registration
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";
import { nowEpoch, newId } from "@/data/core/timestamps";
import type { McpClient } from "@/models/types";

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateMcpClientInput {
  client_name: string;
  redirect_uris: string[];
  grant_types?: string[];
}

// ---------------------------------------------------------------------------
// generateClientId
// ---------------------------------------------------------------------------

export function generateClientId(): string {
  return `firefly_mcp_${newId()}`;
}

// ---------------------------------------------------------------------------
// createMcpClient
// ---------------------------------------------------------------------------

export async function createMcpClient(
  db: Db,
  input: CreateMcpClientInput,
): Promise<McpClient> {
  const id = newId();
  const clientId = generateClientId();
  const now = nowEpoch();

  const sql = `
    INSERT INTO mcp_clients (id, client_id, client_name, redirect_uris, grant_types, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  await db.execute(sql, [
    id,
    clientId,
    input.client_name,
    JSON.stringify(input.redirect_uris),
    JSON.stringify(input.grant_types ?? ["authorization_code"]),
    now,
  ]);

  const client = await getMcpClientById(db, id);
  if (!client) throw new Error(`Failed to retrieve mcp_client ${id} after creation`);
  return client;
}

// ---------------------------------------------------------------------------
// getMcpClientById
// ---------------------------------------------------------------------------

export async function getMcpClientById(
  db: Db,
  id: string,
): Promise<McpClient | null> {
  return db.firstOrNull<McpClient>(
    "SELECT * FROM mcp_clients WHERE id = ?",
    [id],
  );
}

// ---------------------------------------------------------------------------
// getMcpClientByClientId
// ---------------------------------------------------------------------------

export async function getMcpClientByClientId(
  db: Db,
  clientId: string,
): Promise<McpClient | null> {
  return db.firstOrNull<McpClient>(
    "SELECT * FROM mcp_clients WHERE client_id = ?",
    [clientId],
  );
}
