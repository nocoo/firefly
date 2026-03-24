// ---------------------------------------------------------------------------
// MCP Client data layer — CRUD for dynamic client registration
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";
import type { McpClient } from "@/models/types";
import { ulid } from "ulid";

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
  return `firefly_mcp_${ulid()}`;
}

// ---------------------------------------------------------------------------
// createMcpClient
// ---------------------------------------------------------------------------

export async function createMcpClient(
  db: Db,
  input: CreateMcpClientInput,
): Promise<McpClient> {
  const id = ulid();
  const clientId = generateClientId();
  const now = Math.floor(Date.now() / 1000);

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
