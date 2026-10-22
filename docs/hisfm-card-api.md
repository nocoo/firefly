# his.fm episode card API (Firefly consumer)

Firefly loads episode metadata server-side from his.fm **protocol v1**. Canonical spec: [nocoo/his.fm `docs/card-api.md`](https://github.com/nocoo/his.fm/blob/main/docs/card-api.md).

- **Endpoint:** `GET https://his.fm/api/card?url=<encodeURIComponent(episode page URL)>`
- **Validation on posts:** `podcast_url` must be `https://his.fm/episodes/<column>/<slug>`
- **Zod schema:** `src/lib/hisfm/card-schema.ts` (fixtures in `src/lib/hisfm/fixtures/*.json` from live responses)
- **Cache:** Next `unstable_cache` revalidate 300s; his.fm sends `Cache-Control: public, max-age=300, stale-while-revalidate=3600` on 200
- **UI:** `PodcastCard` renders a link-only card when `audio` is omitted; full player when `audio.url` + `audio.mime` are present
