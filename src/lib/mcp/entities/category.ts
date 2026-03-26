// ---------------------------------------------------------------------------
// Category Entity Definition
// ---------------------------------------------------------------------------

import { z } from "zod";
import {
  listCategories,
  getCategoryById,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/data/categories";
import type { Category } from "@/models/types";
import type { EntityConfig } from "../framework/types";

export const categoryEntity: EntityConfig<Category> = {
  name: "category",
  display: "Category",
  plural: "categories",
  dataLayer: {
    list: listCategories,
    getById: getCategoryById,
    getBySlug: getCategoryBySlug,
    create: createCategory,
    update: updateCategory,
    delete: deleteCategory,
  },
  schemas: {
    create: {
      name: z.string(),
      slug: z.string(),
      description: z.string().optional(),
      sort_order: z.number().optional(),
    },
    update: {
      name: z.string().optional(),
      new_slug: z.string().optional(),
      description: z.string().nullable().optional(),
      sort_order: z.number().optional(),
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
    list: "List all categories ordered by sort_order then name.",
  },
};
