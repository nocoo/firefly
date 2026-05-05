/**
 * Database adapter abstraction for the migration system.
 *
 * Two implementations:
 * - CfRestAdapter     — remote Cloudflare D1 via REST API (prod)
 * - WorkerHttpAdapter — local wrangler dev worker via HTTP (local E2E)
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface DbAdapter {
  /** Execute a DDL/DML statement (CREATE, ALTER, INSERT, UPDATE, DELETE). */
  execute(sql: string): Promise<void>;
  /** Run a read-only SELECT and return rows. */
  query<T = Record<string, unknown>>(sql: string): Promise<T[]>;
  /** Human-readable label for logging. */
  readonly label: string;
}

// ---------------------------------------------------------------------------
// CF REST API adapter (remote D1)
// ---------------------------------------------------------------------------

export class CfRestAdapter implements DbAdapter {
  private readonly apiUrl: string;

  constructor(
    private accountId: string,
    private apiToken: string,
    databaseId: string,
    public readonly label: string,
  ) {
    this.apiUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
  }

  async execute(sql: string): Promise<void> {
    await this.run(sql);
  }

  async query<T = Record<string, unknown>>(sql: string): Promise<T[]> {
    return this.run(sql) as Promise<T[]>;
  }

  private async run(sql: string): Promise<unknown[]> {
    const res = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql }),
    });

    const data = (await res.json()) as {
      success: boolean;
      errors?: Array<{ message: string }>;
      result?: Array<{ results?: unknown[] }>;
    };

    if (!data.success) {
      const msg =
        data.errors?.map((e) => e.message).join(", ") ?? "Unknown error";
      throw new Error(msg);
    }

    return (data.result?.[0]?.results as unknown[]) ?? [];
  }
}

// ---------------------------------------------------------------------------
// Worker HTTP adapter (local wrangler dev)
// ---------------------------------------------------------------------------

export class WorkerHttpAdapter implements DbAdapter {
  constructor(
    private workerUrl: string,
    private workerSecret: string,
  ) {}

  get label() {
    return `local (${this.workerUrl})`;
  }

  async execute(sql: string): Promise<void> {
    // Strip PRAGMA statements — Miniflare's local D1.exec() does not
    // support PRAGMA. This is safe because the local DB is always fresh
    // (cleaned before each E2E run), so FK constraints during table
    // reconstruction are irrelevant.
    const cleaned = sql
      .split("\n")
      .filter((line) => !/^\s*PRAGMA\b/i.test(line))
      .join("\n")
      .trim();

    if (!cleaned) return;

    // Miniflare's D1.exec() doesn't handle multi-line SQL reliably.
    // Since PRAGMA is stripped, there's no need for a shared connection.
    // Split into individual statements and execute each separately.
    const statements = cleaned
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      await this.post("/api/v1/execute", stmt);
    }
  }

  async query<T = Record<string, unknown>>(sql: string): Promise<T[]> {
    return this.post("/api/v1/query", sql) as Promise<T[]>;
  }

  private async post(path: string, sql: string): Promise<unknown[]> {
    const res = await fetch(`${this.workerUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.workerSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Worker ${path} returned ${res.status}: ${body}`);
    }

    const data = (await res.json()) as {
      results?: unknown[];
      error?: string;
    };

    if (data.error) throw new Error(data.error);
    return data.results ?? [];
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function loadEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const env: Record<string, string> = {};
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
  }
  return env;
}

export function createAdapter(target: "prod" | "local"): DbAdapter {
  if (target === "local") {
    return new WorkerHttpAdapter(
      "http://localhost:8787",
      "test-secret",
    );
  }

  // Remote prod target needs CF credentials from .env
  const root = resolve(import.meta.dir, "../..");
  const env = { ...loadEnvFile(resolve(root, ".env")) };

  const accountId = env.CF_ACCOUNT_ID ?? process.env.CF_ACCOUNT_ID;
  const apiToken = env.CF_API_TOKEN ?? process.env.CF_API_TOKEN;

  if (!accountId || !apiToken) {
    throw new Error(
      "Missing CF_ACCOUNT_ID or CF_API_TOKEN (check .env or environment)",
    );
  }

  const dbId = env.CF_D1_DATABASE_ID ?? process.env.CF_D1_DATABASE_ID;
  if (!dbId) throw new Error("Missing CF_D1_DATABASE_ID");
  return new CfRestAdapter(accountId, apiToken, dbId, `prod (${dbId})`);
}
