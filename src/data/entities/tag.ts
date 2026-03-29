// ---------------------------------------------------------------------------
// Tag entity — thin wrapper over taxonomy factory
// ---------------------------------------------------------------------------

import type { Tag } from "@/models/types";
import { createTaxonomyEntity } from "@/data/core/taxonomy-factory";

// ---------------------------------------------------------------------------
// Input types (D5: camelCase)
// ---------------------------------------------------------------------------

export interface CreateTagInput {
  name: string;
  slug: string;
}

export interface UpdateTagInput {
  name?: string;
  slug?: string;
}

// ---------------------------------------------------------------------------
// Entity instance
// ---------------------------------------------------------------------------

const entity = createTaxonomyEntity<Tag, CreateTagInput, UpdateTagInput>({
  table: "tags",
  entityName: "Tag",
  fields: {
    name: { column: "name" },
    slug: { column: "slug" },
  },
  orderBy: "name ASC",
  cacheTtl: 5 * 60 * 1000,
  insertColumns: ["id", "name", "slug", "created_at", "updated_at"],
  buildInsertParams: (id: string, input: CreateTagInput, now: number) => [id, input.name, input.slug, now, now],
});

// ---------------------------------------------------------------------------
// Re-exports (zero consumer changes)
// ---------------------------------------------------------------------------

export const listTags = entity.list;
export const getTagBySlug = entity.getBySlug;
export const getTagById = entity.getById;
export const createTag = entity.create;
export const updateTag = entity.update;
export const deleteTag = entity.delete;
export const invalidateTagCache = entity.invalidateCache;
