import { createTaxonomySlugHandlers } from "@/lib/taxonomy-routes";
import {
  getCategoryBySlug,
  updateCategory,
  deleteCategory,
  type UpdateCategoryInput,
} from "@/data/entities/category";

export const { GET, PUT, DELETE } = createTaxonomySlugHandlers<
  { id: string },
  UpdateCategoryInput
>({
  entityName: "Category",
  getBySlug: getCategoryBySlug,
  update: updateCategory,
  delete: deleteCategory,
  parseUpdateBody: (body) => {
    const sortOrder =
      (body.sortOrder as number | undefined) ?? (body.sort_order as number | undefined);
    return {
      ...(body.name !== undefined && { name: body.name as string }),
      ...(body.slug !== undefined && { slug: body.slug as string }),
      ...(body.description !== undefined && { description: body.description as string | null }),
      ...(sortOrder != null && { sortOrder }),
    };
  },
});
