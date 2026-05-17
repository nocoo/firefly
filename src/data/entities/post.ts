// ---------------------------------------------------------------------------
// Post entity — barrel re-export of CRUD/aggregation primitives (D4)
//
// The implementation is split across:
//   - post-types.ts       (input/output types + VIEW_QUERY)
//   - post-cache.ts       (count cache + archives cache + invalidate)
//   - post-queries.ts     (listPosts, getPostBySlug, getPostById)
//   - post-mutations.ts   (createPost, updatePost, deletePost, batchUpdatePosts)
//   - post-tags.ts        (getPostTags, getPostsTagsMap, setPostTags)
//   - post-aggregates.ts  (archives, years, adjacency, refresh counts, rowid)
//   - post-search.ts      (searchPosts, ftsSync)
// ---------------------------------------------------------------------------

export type {
  CreatePostInput,
  UpdatePostInput,
  ListPostsOptions,
  ListPostsResult,
  BatchUpdateInput,
  MonthlyArchive,
  PostYearCount,
  AdjacentPost,
  AdjacentPosts,
  SearchPostsOptions,
  SearchResult,
  FtsSyncUpsert,
  FtsSyncDelete,
  FtsSyncInput,
} from "./post-types";

export { invalidatePostCaches } from "./post-cache";
export { listPosts, getPostBySlug, getPostById } from "./post-queries";
export {
  createPost,
  updatePost,
  deletePost,
  batchUpdatePosts,
} from "./post-mutations";
export { getPostTags, getPostsTagsMap, setPostTags } from "./post-tags";
export {
  refreshCategoryPostCount,
  refreshAllCategoryPostCounts,
  refreshAllTagPostCounts,
  listMonthlyArchives,
  listPostYears,
  getAdjacentPosts,
  getPostRowid,
} from "./post-aggregates";
export { searchPosts, ftsSync } from "./post-search";
