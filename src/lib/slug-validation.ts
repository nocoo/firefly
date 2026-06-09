/**
 * Slug validation helpers shared by client-side form validators.
 *
 * Backend validation is canonical — these run on blur to give users immediate
 * feedback before submit, so they don't lose context by waiting for the
 * server round-trip. Keep the rules in lockstep with backend slug checks.
 *
 * Format: lowercase a-z, 0-9, hyphens; 1..80 chars; no leading/trailing
 *   hyphen; no double hyphen. Matches the WordPress-derived convention used
 *   throughout this project (see post slugs and taxonomy slugs).
 */

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MAX = 80;

export type SlugValidationError =
  | { kind: "empty" }
  | { kind: "format" }
  | { kind: "too-long"; max: number }
  | { kind: "duplicate" };

export function validateSlug(
  raw: string,
  existing: ReadonlySet<string>,
): SlugValidationError | null {
  const slug = raw.trim();
  if (!slug) return { kind: "empty" };
  if (slug.length > SLUG_MAX) return { kind: "too-long", max: SLUG_MAX };
  if (!SLUG_RE.test(slug)) return { kind: "format" };
  if (existing.has(slug)) return { kind: "duplicate" };
  return null;
}

export function formatSlugError(err: SlugValidationError): string {
  switch (err.kind) {
    case "empty":
      return "别名不能为空";
    case "format":
      return "别名只能包含小写字母、数字、连字符（不能以连字符开头/结尾或连续连字符）";
    case "too-long":
      return `别名长度不能超过 ${err.max} 个字符`;
    case "duplicate":
      return "别名已存在";
  }
}
