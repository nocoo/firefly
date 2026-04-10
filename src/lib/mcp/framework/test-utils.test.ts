// ---------------------------------------------------------------------------
// MCP Framework Test Utilities — Unit Tests
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { createMockContext, parseToolResult, expectError } from "./test-utils";

describe("createMockContext", () => {
  it("creates a context with a mock db", () => {
    const ctx = createMockContext();

    expect(ctx.db).toBeDefined();
  });
});

describe("parseToolResult", () => {
  it("parses JSON from text content", () => {
    const result = {
      content: [{ type: "text", text: JSON.stringify({ ok: true }) }],
    } as CallToolResult;

    expect(parseToolResult(result)).toEqual({ ok: true });
  });

  it("throws for non-text content", () => {
    const result = {
      content: [{ type: "image", data: "abc", mimeType: "image/png" }],
    } as CallToolResult;

    expect(() => parseToolResult(result)).toThrow(
      "Expected text content, got image",
    );
  });
});

describe("expectError", () => {
  it("asserts an error result without requiring a substring", () => {
    const result = {
      isError: true,
      content: [{ type: "text", text: "something failed" }],
    } as CallToolResult;

    expect(() => expectError(result)).not.toThrow();
  });

  it("checks the substring when text content is present", () => {
    const result = {
      isError: true,
      content: [{ type: "text", text: "category lookup failed" }],
    } as CallToolResult;

    expect(() => expectError(result, "lookup failed")).not.toThrow();
  });

  it("throws for non-text content when checking a substring", () => {
    const result = {
      isError: true,
      content: [{ type: "image", data: "abc", mimeType: "image/png" }],
    } as CallToolResult;

    expect(() => expectError(result, "failed")).toThrow(
      "Expected text content, got image",
    );
  });
});
