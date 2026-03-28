// ---------------------------------------------------------------------------
// Tag Entity Definition
// ---------------------------------------------------------------------------

import { z } from "zod";
import {
  listTags,
  getTagById,
  getTagBySlug,
  createTag,
  updateTag,
  deleteTag,
} from "@/data/entities/tag";
import type { Tag } from "@/models/types";
import type { EntityConfig } from "../framework/types";

export const tagEntity: EntityConfig<Tag> = {
  name: "tag",
  display: "Tag",
  dataLayer: {
    list: listTags,
    getById: getTagById,
    getBySlug: getTagBySlug,
    create: createTag,
    update: updateTag,
    delete: deleteTag,
  },
  schemas: {
    create: {
      name: z.string(),
      slug: z.string(),
    },
    update: {
      name: z.string().optional(),
      new_slug: z.string().optional(),
    },
  },
  hooks: {
    mapUpdateInput: (args) => {
      const { new_slug, ...rest } = args;
      if (new_slug !== undefined) {
        return { ...rest, slug: new_slug };
      }
      return rest;
    },
  },
  descriptions: {
    list: "List all tags ordered by name.",
  },
};
