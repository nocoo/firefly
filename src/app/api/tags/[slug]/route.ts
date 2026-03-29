import { createTaxonomySlugHandlers } from "@/lib/taxonomy-routes";
import {
  getTagBySlug,
  updateTag,
  deleteTag,
  type UpdateTagInput,
} from "@/data/entities/tag";

export const { GET, PUT, DELETE } = createTaxonomySlugHandlers<
  { id: string },
  UpdateTagInput
>({
  entityName: "Tag",
  getBySlug: getTagBySlug,
  update: updateTag,
  delete: deleteTag,
});
