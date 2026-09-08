const TRAILING = /[。．.]+$/u;
const FIRST_PUNCT = /^(.+?)([，,、；;：:？?！!.。])(.*)$/u;

export function splitJournalSlogan(
  tagline: string,
  fallback: string,
): { first: string; punct: string | null; rest: string | null } {
  const text = (tagline.trim() || fallback).replace(TRAILING, "");
  const match = text.match(FIRST_PUNCT);
  const rest = match?.[3]?.trim().replace(TRAILING, "") ?? "";
  if (!match || !rest) {
    return { first: text, punct: null, rest: null };
  }
  return { first: match[1].trim(), punct: match[2], rest };
}
