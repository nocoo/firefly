/**
 * his.fm GET /api/card protocol v1 — see nocoo/his.fm docs/card-api.md
 */
import { z } from "zod";

export const HISFM_CARD_API_VERSION = 1;

export const hisFmCardCoverSizeSchema = z.object({
  url: z.string().url(),
  width: z.number().int().positive(),
});

export const hisFmCardAudioSchema = z
  .object({
    url: z.string().url(),
    mime: z.string(),
    bytes: z.number().int().nonnegative().optional(),
  })
  .passthrough();

export const hisFmCardCoverSchema = z
  .object({
    url: z.string().url(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    sizes: z.array(hisFmCardCoverSizeSchema).optional(),
    frame_svg: z.string().url().optional(),
  })
  .passthrough();

export const hisFmCardThemeSchema = z
  .object({
    name: z.string().optional(),
    accent: z.string().optional(),
    ink: z.string().optional(),
    paper: z.string().optional(),
  })
  .passthrough();

export const hisFmCardResponseSchema = z
  .object({
    v: z.literal(HISFM_CARD_API_VERSION),
    status: z.enum(["published", "not_found"]),
    page_url: z.string().url().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    show: z.string().optional(),
    column: z.string().optional(),
    episode_label: z.string().optional(),
    published_at: z.string().optional(),
    duration: z.number().int().nonnegative().optional(),
    audio: hisFmCardAudioSchema.optional(),
    cover: hisFmCardCoverSchema.optional(),
    theme: hisFmCardThemeSchema.optional(),
  })
  .passthrough();

export type HisFmCardResponse = z.infer<typeof hisFmCardResponseSchema>;

export const hisFmPublishedCardSchema = z.object({
  v: z.literal(HISFM_CARD_API_VERSION),
  status: z.literal("published"),
  page_url: z.string().url(),
  title: z.string().min(1),
  description: z.string().optional(),
  show: z.string().optional(),
  column: z.string().optional(),
  episode_label: z.string().optional(),
  published_at: z.string().optional(),
  duration: z.number().int().nonnegative().optional(),
  audio: hisFmCardAudioSchema.optional(),
  cover: hisFmCardCoverSchema,
  theme: hisFmCardThemeSchema.optional(),
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
