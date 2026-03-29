// ---------------------------------------------------------------------------
// Taxonomy route helpers — shared GET/PUT/DELETE for [slug] routes
// Eliminates duplicated handler scaffolding between tags and categories
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { getDb, DbError } from "@/lib/db";
import type { Db } from "@/lib/db";
import { jsonResponse, errorResponse, notFoundResponse } from "@/lib/api";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface TaxonomySlugRouteConfig<T extends { id: string }, UpdateInput> {
  /** Human-readable entity name for 404 messages and logs (e.g. "Tag") */
  entityName: string;
  /** Look up entity by slug */
  getBySlug: (db: Db, slug: string) => Promise<T | null>;
  /** Update entity by ID */
  update: (db: Db, id: string, input: UpdateInput) => Promise<T | null>;
  /** Delete entity by ID */
  delete: (db: Db, id: string) => Promise<boolean>;
  /**
   * Parse and normalize the raw JSON body into an UpdateInput.
   * Handles any snake_case → camelCase mapping the entity needs.
   * If omitted, the raw body is cast directly to UpdateInput.
   */
  parseUpdateBody?: (body: Record<string, unknown>) => UpdateInput;
}

interface RouteParams {
  params: Promise<{ slug: string }>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createTaxonomySlugHandlers<T extends { id: string }, UpdateInput>(
  config: TaxonomySlugRouteConfig<T, UpdateInput>,
) {
  const { entityName, getBySlug, update, delete: del, parseUpdateBody } = config;

  function handleError(error: unknown) {
    if (error instanceof DbError) {
      return errorResponse(error.message, error.status ?? 500);
    }
    console.error(`${entityName} API error:`, error);
    return errorResponse("Internal server error", 500);
  }

  async function GET(_request: NextRequest, { params }: RouteParams) {
    try {
      const { slug } = await params;
      const db = getDb();
      const entity = await getBySlug(db, slug);
      if (!entity) return notFoundResponse(entityName);
      return jsonResponse(entity);
    } catch (error) {
      return handleError(error);
    }
  }

  async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
      const { slug } = await params;
      const db = getDb();

      const existing = await getBySlug(db, slug);
      if (!existing) return notFoundResponse(entityName);

      let raw: Record<string, unknown>;
      try {
        raw = await request.json();
      } catch {
        return errorResponse("Invalid JSON body");
      }

      const input = parseUpdateBody ? parseUpdateBody(raw) : (raw as UpdateInput);
      const updated = await update(db, existing.id, input);
      if (!updated) return notFoundResponse(entityName);

      return jsonResponse(updated);
    } catch (error) {
      return handleError(error);
    }
  }

  async function DELETE(_request: NextRequest, { params }: RouteParams) {
    try {
      const { slug } = await params;
      const db = getDb();

      const existing = await getBySlug(db, slug);
      if (!existing) return notFoundResponse(entityName);

      const deleted = await del(db, existing.id);
      if (!deleted) return notFoundResponse(entityName);

      return jsonResponse({ deleted: true });
    } catch (error) {
      return handleError(error);
    }
  }

  return { GET, PUT, DELETE };
}
