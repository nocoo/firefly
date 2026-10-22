# his.fm episode card API (Firefly consumer)

Firefly loads episode metadata server-side from his.fm **protocol v1**. Canonical spec: [nocoo/his.fm `docs/card-api.md`](https://github.com/nocoo/his.fm/blob/main/docs/card-api.md).

- **Endpoint:** `GET https://his.fm/api/card?url=<encodeURIComponent(episode page URL)>`
- **Validation on posts:** `podcast_url` must be `https://his.fm/episodes/<column>/<slug>`
- **Zod schema:** `src/lib/hisfm/card-schema.ts` (fixtures in `src/lib/hisfm/fixtures/*.json` from live responses)
- **Cache:** Next `unstable_cache` revalidate 300s; his.fm sends `Cache-Control: public, max-age=300, stale-while-revalidate=3600` on 200
- **UI:** `PodcastPlayer` renders an inline control row below the article's featured image (or header when there is no image). It contains play/pause, seek, elapsed/total time, speed and the linked his.fm wordmark + symbol. Without audio, only the brand link remains.
- **Theme:** Controls and SVGs inherit Firefly blog light/dark tokens, not episode theme colors. There is no card background, border, episode cover or description.
- **Brand provenance:** SVG paths and lockup proportions are copied from `his.fm` revision `cfbefd2`, `apps/web/src/brand/Brand.tsx` and `apps/web/src/public/public.css`. The custom lettering is outlined SVG artwork, so it preserves the original typography without loading a substitute font.
- **Preview:** `/podcast-post-preview?episode=ep03` uses recorded API fixtures in development/E2E only. `episode=silent` checks missing audio; `cover=none` checks articles without a cover. This preview does not create or modify posts.
