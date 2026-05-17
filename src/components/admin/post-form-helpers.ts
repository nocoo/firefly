// ---------------------------------------------------------------------------
// post-form helpers — submit body builder + datetime-local conversion
// ---------------------------------------------------------------------------

import type { PostStatus } from "@/models/types";
import type { ReferenceState } from "./post-form-reference-fields";

export interface BuildSubmitBodyArgs {
  isEditing: boolean;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  status: PostStatus;
  categoryId: string;
  featuredImage: string;
  selectedTags: string[];
  publishedAtLocal: string;
  reference: ReferenceState;
}

/** Convert a `<input type="datetime-local">` value to a unix epoch (seconds). */
export function datetimeLocalToEpoch(value: string): number | undefined {
  return value ? Math.floor(new Date(value).getTime() / 1000) : undefined;
}

/** Format a unix epoch as a local datetime-input value (`YYYY-MM-DDTHH:mm`). */
export function epochToDatetimeLocal(epoch: number | null | undefined): string {
  if (!epoch) return "";
  const d = new Date(epoch * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Build the JSON body for POST/PUT to the posts API, including reference fields. */
export function buildSubmitBody(args: BuildSubmitBodyArgs): Record<string, unknown> {
  const {
    isEditing,
    title,
    slug,
    content,
    excerpt,
    status,
    categoryId,
    featuredImage,
    selectedTags,
    publishedAtLocal,
    reference,
  } = args;

  const publishedAtEpoch = datetimeLocalToEpoch(publishedAtLocal);

  const refUrl = reference.url;
  const refTitle = reference.title;
  const refDescription = reference.description;
  const refImage = reference.image;

  const refFields = isEditing
    ? {
        // Update: null clears, undefined omits.
        // When URL is empty, clear all 4 reference fields to avoid orphan metadata.
        reference_url: refUrl || null,
        reference_title: refUrl ? refTitle || null : null,
        reference_description: refUrl ? refDescription || null : null,
        reference_image: refUrl ? refImage || null : null,
      }
    : {
        // Create: undefined omits (defaults to NULL in DB)
        reference_url: refUrl || undefined,
        reference_title: refUrl ? refTitle || undefined : undefined,
        reference_description: refUrl ? refDescription || undefined : undefined,
        reference_image: refUrl ? refImage || undefined : undefined,
      };

  return {
    title,
    slug,
    content,
    excerpt: excerpt || undefined,
    status,
    category_id: categoryId || undefined,
    featured_image: featuredImage || undefined,
    tag_ids: selectedTags,
    // published_at: epoch when set, null to clear (edit), undefined to omit (create)
    published_at: isEditing ? (publishedAtEpoch ?? null) : publishedAtEpoch,
    ...refFields,
  };
}
