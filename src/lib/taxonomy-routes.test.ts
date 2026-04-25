// ---------------------------------------------------------------------------
// taxonomy-routes — unit tests
// Covers GET / PUT / DELETE + handleError with DbError and generic errors
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createTaxonomySlugHandlers } from "./taxonomy-routes";
import type { TaxonomySlugRouteConfig } from "./taxonomy-routes";
import type { Db } from "@/lib/db";
import type { Mock } from "vitest";

// ---------------------------------------------------------------------------
// Mock getDb to return a mock db instance
// ---------------------------------------------------------------------------

const mockDb = {} as Db;
vi.mock("@/lib/db", () => ({
  getDb: () => mockDb,
  DbError: class DbError extends Error {
    status: number | undefined;
    constructor(message: string, status?: number) {
      super(message);
      this.name = "DbError";
      this.status = status;
    }
  },
}));

import { DbError } from "@/lib/db";

// ---------------------------------------------------------------------------
// Test entity type
// ---------------------------------------------------------------------------

interface TestEntity {
  id: string;
  slug: string;
  name: string;
}

interface TestUpdateInput {
  name?: string | undefined;
}

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

type GetBySlugFn = (db: Db, slug: string) => Promise<TestEntity | null>;
type UpdateFn = (db: Db, id: string, input: TestUpdateInput) => Promise<TestEntity | null>;
type DeleteFn = (db: Db, id: string) => Promise<boolean>;
type ParseUpdateBodyFn = (body: Record<string, unknown>) => TestUpdateInput;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(method: string, body?: unknown): NextRequest {
  const url = "http://localhost/api/test/tag-1";
  if (body) {
    return new NextRequest(url, {
      method,
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
  }
  return new NextRequest(url, { method });
}

function makeParams(slug = "tag-1"): { params: Promise<{ slug: string }> } {
  return { params: Promise.resolve({ slug }) };
}

const sampleEntity: TestEntity = { id: "id-1", slug: "tag-1", name: "Tag One" };

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

describe("createTaxonomySlugHandlers", () => {
  let getBySlug: Mock<GetBySlugFn>;
  let update: Mock<UpdateFn>;
  let del: Mock<DeleteFn>;
  let parseUpdateBody: Mock<ParseUpdateBodyFn>;
  let handlers: ReturnType<typeof createTaxonomySlugHandlers<TestEntity, TestUpdateInput>>;

  beforeEach(() => {
    getBySlug = vi.fn<GetBySlugFn>();
    update = vi.fn<UpdateFn>();
    del = vi.fn<DeleteFn>();
    parseUpdateBody = vi.fn<ParseUpdateBodyFn>();

    const config: TaxonomySlugRouteConfig<TestEntity, TestUpdateInput> = {
      entityName: "Tag",
      getBySlug,
      update,
      delete: del,
      parseUpdateBody,
    };
    handlers = createTaxonomySlugHandlers(config);
  });

  // ---- GET ----

  describe("GET", () => {
    it("returns entity when found", async () => {
      getBySlug.mockResolvedValue(sampleEntity);
      const res = await handlers.GET(makeRequest("GET"), makeParams());
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual(sampleEntity);
    });

    it("returns 404 when entity not found", async () => {
      getBySlug.mockResolvedValue(null);
      const res = await handlers.GET(makeRequest("GET"), makeParams());
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toContain("Tag not found");
    });

    it("handles DbError with custom status", async () => {
      getBySlug.mockRejectedValue(new DbError("Unique constraint", 409));
      const res = await handlers.GET(makeRequest("GET"), makeParams());
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toBe("Unique constraint");
    });

    it("handles DbError without status (defaults to 500)", async () => {
      getBySlug.mockRejectedValue(new DbError("DB is down"));
      const res = await handlers.GET(makeRequest("GET"), makeParams());
      expect(res.status).toBe(500);
    });

    it("handles generic error (500)", async () => {
      getBySlug.mockRejectedValue(new Error("unexpected"));
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const res = await handlers.GET(makeRequest("GET"), makeParams());
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe("Internal server error");
      expect(errSpy).toHaveBeenCalled();
    });
  });

  // ---- PUT ----

  describe("PUT", () => {
    it("updates entity with parseUpdateBody", async () => {
      getBySlug.mockResolvedValue(sampleEntity);
      parseUpdateBody.mockReturnValue({ name: "Mapped" });
      update.mockResolvedValue({ ...sampleEntity, name: "Mapped" });

      const res = await handlers.PUT(
        makeRequest("PUT", { name: "Mapped" }),
        makeParams(),
      );
      expect(res.status).toBe(200);
      expect(parseUpdateBody).toHaveBeenCalledWith({ name: "Mapped" });
      expect(update).toHaveBeenCalledWith(mockDb, "id-1", { name: "Mapped" });
    });

    it("returns 404 when entity not found for update", async () => {
      getBySlug.mockResolvedValue(null);
      const res = await handlers.PUT(
        makeRequest("PUT", { name: "X" }),
        makeParams(),
      );
      expect(res.status).toBe(404);
    });

    it("returns 400 for invalid JSON body", async () => {
      getBySlug.mockResolvedValue(sampleEntity);
      const req = new NextRequest("http://localhost/api/test/tag-1", {
        method: "PUT",
        body: "not json",
        headers: { "Content-Type": "application/json" },
      });
      const res = await handlers.PUT(req, makeParams());
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Invalid JSON");
    });

    it("returns 404 when update returns null", async () => {
      getBySlug.mockResolvedValue(sampleEntity);
      parseUpdateBody.mockReturnValue({ name: "X" });
      update.mockResolvedValue(null);

      const res = await handlers.PUT(
        makeRequest("PUT", { name: "X" }),
        makeParams(),
      );
      expect(res.status).toBe(404);
    });

    it("handles DbError during update", async () => {
      getBySlug.mockResolvedValue(sampleEntity);
      parseUpdateBody.mockReturnValue({ name: "X" });
      update.mockRejectedValue(new DbError("Slug already exists", 409));

      const res = await handlers.PUT(
        makeRequest("PUT", { name: "X" }),
        makeParams(),
      );
      expect(res.status).toBe(409);
    });

    it("handles generic error during update", async () => {
      getBySlug.mockResolvedValue(sampleEntity);
      parseUpdateBody.mockReturnValue({ name: "X" });
      update.mockRejectedValue(new Error("oops"));
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const res = await handlers.PUT(
        makeRequest("PUT", { name: "X" }),
        makeParams(),
      );
      expect(res.status).toBe(500);
      expect(errSpy).toHaveBeenCalled();
    });
  });

  // ---- PUT without parseUpdateBody ----

  describe("PUT without parseUpdateBody", () => {
    it("passes raw body directly when parseUpdateBody is omitted", async () => {
      const handlersNoParser = createTaxonomySlugHandlers<TestEntity, TestUpdateInput>({
        entityName: "Tag",
        getBySlug,
        update,
        delete: del,
        // No parseUpdateBody
      });

      getBySlug.mockResolvedValue(sampleEntity);
      update.mockResolvedValue({ ...sampleEntity, name: "Raw" });

      const res = await handlersNoParser.PUT(
        makeRequest("PUT", { name: "Raw" }),
        makeParams(),
      );
      expect(res.status).toBe(200);
      expect(update).toHaveBeenCalledWith(mockDb, "id-1", { name: "Raw" });
    });
  });

  // ---- DELETE ----

  describe("DELETE", () => {
    it("deletes entity successfully", async () => {
      getBySlug.mockResolvedValue(sampleEntity);
      del.mockResolvedValue(true);

      const res = await handlers.DELETE(makeRequest("DELETE"), makeParams());
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ deleted: true });
    });

    it("returns 404 when entity not found for deletion", async () => {
      getBySlug.mockResolvedValue(null);
      const res = await handlers.DELETE(makeRequest("DELETE"), makeParams());
      expect(res.status).toBe(404);
    });

    it("returns 404 when delete returns false", async () => {
      getBySlug.mockResolvedValue(sampleEntity);
      del.mockResolvedValue(false);

      const res = await handlers.DELETE(makeRequest("DELETE"), makeParams());
      expect(res.status).toBe(404);
    });

    it("handles DbError during deletion", async () => {
      getBySlug.mockResolvedValue(sampleEntity);
      del.mockRejectedValue(new DbError("FK constraint", 409));

      const res = await handlers.DELETE(makeRequest("DELETE"), makeParams());
      expect(res.status).toBe(409);
    });

    it("handles generic error during deletion", async () => {
      getBySlug.mockResolvedValue(sampleEntity);
      del.mockRejectedValue(new Error("boom"));
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const res = await handlers.DELETE(makeRequest("DELETE"), makeParams());
      expect(res.status).toBe(500);
      expect(errSpy).toHaveBeenCalled();
    });
  });
});
