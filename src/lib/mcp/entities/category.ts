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
} from "@/data/entities/category";
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
    mapCreateInput: (args) => {
      const { sort_order, ...rest } = args;
      return { ...rest, ...(sort_order !== undefined && { sortOrder: sort_order }) };
    },
    mapUpdateInput: (args) => {
      const { new_slug, sort_order, ...rest } = args;
      return {
        ...rest,
        ...(new_slug !== undefined && { slug: new_slug }),
        ...(sort_order !== undefined && { sortOrder: sort_order }),
      };
    },
  },
  descriptions: {
    list: "List all categories ordered by sort_order then name.",
  },
};
