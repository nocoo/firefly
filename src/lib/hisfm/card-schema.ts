/**
 * his.fm GET /api/card protocol v1 — adjust field names here when the API stabilizes.
 */
import { z } from "zod";

export const HISFM_CARD_API_VERSION = 1;

export const hisFmCardAudioSchema = z
  .object({
    url: z.string().url(),
    type: z.string(),
    size: z.number().int().nonnegative().optional(),
  })
  .passthrough();

export const hisFmCardCoverSchema = z
  .object({
    url: z.string().url(),
    w1400: z.string().url().optional(),
    w400: z.string().url().optional(),
    w200: z.string().url().optional(),
    frame_svg: z.string().url().optional(),
    frame: z.string().url().optional(),
  })
  .passthrough();

export const hisFmCardBrandSchema = z
  .object({
    accent: z.string().optional(),
    accent_color: z.string().optional(),
    colors: z.array(z.string()).optional(),
  })
  .passthrough();

export const hisFmCardResponseSchema = z
  .object({
    v: z.literal(HISFM_CARD_API_VERSION),
    status: z.enum(["published", "not_found"]),
    url: z.string().url().optional(),
    title: z.string().optional(),
    summary: z.string().optional(),
    series: z.string().optional(),
    column: z.string().optional(),
    show: z.string().optional(),
    episode: z.union([z.number(), z.string()]).optional(),
    episode_label: z.string().optional(),
    duration: z.number().nonnegative().optional(),
    published_at: z.union([z.string(), z.number()]).optional(),
    audio: hisFmCardAudioSchema.optional(),
    cover: hisFmCardCoverSchema.optional(),
    brand: hisFmCardBrandSchema.optional(),
  })
  .passthrough();

export type HisFmCardResponse = z.infer<typeof hisFmCardResponseSchema>;

/** Fields required to render the public podcast card. */
export const hisFmPublishedCardSchema = z.object({
  v: z.literal(HISFM_CARD_API_VERSION),
  status: z.literal("published"),
  url: z.string().url(),
  title: z.string().min(1),
  summary: z.string().optional(),
  series: z.string().optional(),
  column: z.string().optional(),
  show: z.string().optional(),
  episode: z.union([z.number(), z.string()]).optional(),
  episode_label: z.string().optional(),
  duration: z.number().nonnegative(),
  published_at: z.union([z.string(), z.number()]).optional(),
  audio: hisFmCardAudioSchema,
  cover: hisFmCardCoverSchema,
  brand: hisFmCardBrandSchema.optional(),
});

export type HisFmPublishedCard = z.infer<typeof hisFmPublishedCardSchema>;

export function parseHisFmCardPayload(
  json: unknown,
): HisFmPublishedCard | null {
  const outer = hisFmCardResponseSchema.safeParse(json);
  if (!outer.success) return null;
  if (outer.data.status !== "published") return null;
  const inner = hisFmPublishedCardSchema.safeParse(outer.data);
  return inner.success ? inner.data : null;
}
