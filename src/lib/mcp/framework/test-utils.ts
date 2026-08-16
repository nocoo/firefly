// ---------------------------------------------------------------------------
// Entity-Driven MCP Framework — Shared Test Utilities
// ---------------------------------------------------------------------------

import { vi, type Mocked } from "vitest";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { DataLayer, ToolContext } from "./types";
import { createMockDb } from "@/data/core/test-utils";

export { createMockDb } from "@/data/core/test-utils";

/** Create a ToolContext backed by a mock Db. */
export function createMockContext(): ToolContext {
  return { db: createMockDb() };
}

/**
 * Fresh data-layer spies for one test file. Do not vi.mock the real
 * `@/data/entities/*` module when isolate is off — other files replace
 * that module with a different set of vi.fn() instances, and the entity
 * config keeps the first ones it imported.
 */
export function createMockDataLayer<T>(): Mocked<DataLayer<T>> {
  return {
    list: vi.fn(),
    getById: vi.fn(),
    getBySlug: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
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
