// ---------------------------------------------------------------------------
// Entity-Driven MCP Framework — Shared Test Utilities
// ---------------------------------------------------------------------------

import { vi } from "vitest";
import type { Db } from "@/lib/db";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolContext } from "./types";

/** Create a mock Db instance for unit tests. */
export function createMockDb(): Db {
  return {
    query: vi.fn(),
    firstOrNull: vi.fn(),
    execute: vi.fn(),
    batch: vi.fn(),
  };
}

/** Create a ToolContext backed by a mock Db. */
export function createMockContext(): ToolContext {
  return { db: createMockDb() };
}

/** Parse the JSON text from a successful CallToolResult. */
export function parseToolResult(result: CallToolResult): unknown {
  const item = result.content[0];
  if (item.type !== "text") throw new Error(`Expected text content, got ${item.type}`);
  return JSON.parse(item.text);
}

/** Assert that a CallToolResult is an error, optionally matching a substring. */
export function expectError(
  result: CallToolResult,
  substring?: string,
): void {
  expect(result.isError).toBe(true);
  if (substring) {
    const item = result.content[0];
    if (item.type !== "text") throw new Error(`Expected text content, got ${item.type}`);
    expect(item.text).toContain(substring);
  }
}

// Re-export expect for use in expectError without extra imports
import { expect } from "vitest";
