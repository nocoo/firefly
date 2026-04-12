// ---------------------------------------------------------------------------
// Shared test utilities for the entity data layer
// ---------------------------------------------------------------------------

import { vi } from "vitest";
import type { Db } from "@/lib/db";
import type { Post, PostWithCategory, PostWithAgent } from "@/models/types";

/**
 * Create a mock Db with all methods stubbed as vi.fn().
 * Each test case overrides specific methods as needed.
 */
export function createMockDb(): Db {
  return {
    query: vi.fn(),
    firstOrNull: vi.fn(),
    execute: vi.fn(),
    batch: vi.fn(),
    call: vi.fn(),
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

/**
 * Create a mock Post with default values.
 * Override specific fields as needed for tests.
 */
export function createMockPost(overrides: Partial<Post> = {}): Post {
  return {
    id: "post_123",
    title: "Test Post",
    slug: "test-post",
    content: "Test content",
    content_html: "<p>Test content</p>",
    excerpt: "Test excerpt",
    status: "published",
    category_id: "cat_123",
    ai_agent_id: null,
    featured_image: null,
    comment_enabled: 0,
    comment_count: 0,
    view_count: 0,
    reading_time: 1,
    wp_id: null,
    wp_permalink: null,
    reference_url: null,
    reference_title: null,
    reference_description: null,
    reference_image: null,
    published_at: 1700000000,
    created_at: 1700000000,
    updated_at: 1700000000,
    ...overrides,
  };
}

/**
 * Create a mock PostWithCategory with default values.
 */
export function createMockPostWithCategory(
  overrides: Partial<PostWithCategory> = {},
): PostWithCategory {
  return {
    ...createMockPost(),
    category_name: "Test Category",
    category_slug: "test-category",
    ...overrides,
  };
}

/**
 * Create a mock PostWithAgent with default values.
 */
export function createMockPostWithAgent(
  overrides: Partial<PostWithAgent> = {},
): PostWithAgent {
  return {
    ...createMockPostWithCategory(),
    agent_name: null,
    agent_slug: null,
    agent_avatar_version: null,
    ...overrides,
  };
}
