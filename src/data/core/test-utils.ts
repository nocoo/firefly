// ---------------------------------------------------------------------------
// Shared test utilities for the entity data layer
// ---------------------------------------------------------------------------

import { vi } from "vitest";
import type { Db } from "@/lib/db";

/**
 * Create a mock Db with all four methods stubbed as vi.fn().
 * Each test case overrides specific methods as needed.
 */
export function createMockDb(): Db {
  return {
    query: vi.fn(),
    firstOrNull: vi.fn(),
    execute: vi.fn(),
    batch: vi.fn(),
  };
}

/**
 * Check whether a SQL string contains an expected fragment (case-insensitive).
 * Useful for verifying generated SQL without exact whitespace matching.
 */
export function sqlContains(sql: string, fragment: string): boolean {
  const normalize = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  return normalize(sql).includes(normalize(fragment));
}
