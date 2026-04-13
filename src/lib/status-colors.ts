import type { PostStatus } from "@/models/types";

/**
 * Shared Tailwind class map for post-status badges.
 * Import this instead of duplicating the map in each component.
 */
export const STATUS_COLORS: Record<PostStatus, string> = {
  draft:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  published:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  private:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  archived:
    "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};
