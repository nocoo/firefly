/**
 * L2 API E2E — Admin Comments endpoint
 *
 * Covers: DELETE /api/admin/comments/[id]
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:17028";

describe("DELETE /api/admin/comments/[id]", () => {
  it("returns 404 for non-existent comment", async () => {
    const res = await fetch(`${BASE}/api/admin/comments/nonexistent-comment-id`, {
      method: "DELETE",
    });

    expect(res.status).toBe(404);
  });

  // -------------------------------------------------------------------------
  // Contract regression (STU-2497) — real parent+child DELETE.
  //
  // This exercises the whole `deleteComment` codepath end-to-end. Before
  // STU-2497 the entity used `WITH RECURSIVE tree AS …` to count the subtree.
  // When we made the Worker's `/api/v1/query` gate fail-closed against WITH,
  // that CTE started returning 403 → route 500 → comment_count unchanged.
  // Only mock-based L1 tests existed for `deleteComment`, so the regression
  // slipped through review.
  //
  // Coverage now: create a post with comments enabled → seed one parent and
  // two nested replies via `POST /api/comments` → `DELETE
  // /api/admin/comments/<parent>` → assert the post's `comment_count` drops
  // by exactly 3 (parent + two children).
  // -------------------------------------------------------------------------
  it("cascades a real parent+children subtree and decrements post.comment_count", async () => {
    // Snapshot the current commentsEnabled so the finally block can
    // restore it. This GET runs OUTSIDE the try — a failure here means
    // no mutation has happened yet, so there is nothing to unwind.
    // If the GET returns 200 but has no `commentsEnabled` field the
    // fresh-DB default (false) is a safe recovery target.
    const settingsBefore = await (await fetch(`${BASE}/api/settings`)).json();
    const previouslyEnabled: boolean = !!settingsBefore.commentsEnabled;
    const slug = `e2e-admin-comment-delete-${Date.now()}`;

    try {
      // Enable comments globally (default off). Restore in finally.
      if (!previouslyEnabled) {
        const putRes = await fetch(`${BASE}/api/settings`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ commentsEnabled: true }),
        });
        expect(putRes.status).toBe(200);
      }

      // Seed a published post with per-post comment_enabled = 1.
      const postRes = await fetch(`${BASE}/api/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "E2E Admin Comment DELETE contract",
          slug,
          content: "Body",
          status: "published",
          comment_enabled: 1,
          published_at: Math.floor(Date.now() / 1000),
        }),
      });
      expect(postRes.status).toBe(201);
      const post = await postRes.json();

      // Parent comment.
      const parentRes = await fetch(`${BASE}/api/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post_id: post.id,
          content: "parent",
          author_name: "R",
        }),
      });
      expect(parentRes.status).toBe(201);
      const parent = await parentRes.json();

      // Two child replies under the parent.
      for (const label of ["child-1", "child-2"]) {
        const childRes = await fetch(`${BASE}/api/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            post_id: post.id,
            parent_id: parent.id,
            content: label,
            author_name: "R",
          }),
        });
        expect(childRes.status).toBe(201);
      }

      // Sanity: comment_count is 3.
      const preGet = await fetch(`${BASE}/api/posts/${slug}`);
      expect(preGet.status).toBe(200);
      const preBody = await preGet.json();
      expect(preBody.comment_count).toBe(3);

      // The gate-under-test: admin DELETE cascades the whole subtree.
      const delRes = await fetch(
        `${BASE}/api/admin/comments/${parent.id}`,
        { method: "DELETE" },
      );
      // Before the fix, this was 500 with "Write queries not allowed on
      // /api/v1/query" because `deleteComment` fired a WITH RECURSIVE
      // subtree count that the Worker gate rejected. Now it must be 200.
      expect(delRes.status).toBe(200);
      const delBody = await delRes.json();
      expect(delBody.success).toBe(true);

      // Comment count must drop to 0 (parent + 2 children removed via
      // ON DELETE CASCADE).
      const postGet = await fetch(`${BASE}/api/posts/${slug}`);
      expect(postGet.status).toBe(200);
      const postBody = await postGet.json();
      expect(postBody.comment_count).toBe(0);
    } finally {
      // Cleanup is unconditional on the unique slug. The exact failure
      // mode this PR hardens against — server-side write committed but
      // client-side fetch/json throws before returning 201 — would
      // leak the post if we gated the DELETE on a client-side seed
      // flag. A 404 on a slug that never made it to the DB is a
      // harmless no-op; do NOT reintroduce a guard here (Reviewer-01
      // 15:16Z).
      await fetch(`${BASE}/api/posts/${slug}`, { method: "DELETE" });
      if (!previouslyEnabled) {
        await fetch(`${BASE}/api/settings`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ commentsEnabled: false }),
        });
      }
    }
  });
});
