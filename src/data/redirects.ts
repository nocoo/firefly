// ---------------------------------------------------------------------------
// Redirect data layer
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";
import type { Redirect } from "@/models/types";

/**
 * Look up a redirect by source path.
 */
export async function getRedirectBySource(
  db: Db,
  sourcePath: string,
): Promise<Redirect | null> {
  return db.firstOrNull<Redirect>(
    "SELECT * FROM redirects WHERE source_path = ?",
    [sourcePath],
  );
}

/**
 * Increment the hit counter for a redirect (fire-and-forget).
 */
export async function incrementRedirectHit(
  db: Db,
  id: string,
): Promise<void> {
  await db.execute(
    "UPDATE redirects SET hit_count = hit_count + 1 WHERE id = ?",
    [id],
  );
}
