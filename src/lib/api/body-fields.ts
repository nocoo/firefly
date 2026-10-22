/** Read optional JSON body fields where explicit `null` must clear a column. */

export function readOptionalBodyString(
  body: Record<string, unknown>,
  camelKey: string,
  snakeKey: string,
): string | null | undefined {
  if (Object.hasOwn(body, camelKey)) {
    const value = body[camelKey];
    if (value === null) return null;
    return typeof value === "string" ? value : undefined;
  }
  if (Object.hasOwn(body, snakeKey)) {
    const value = body[snakeKey];
    if (value === null) return null;
    return typeof value === "string" ? value : undefined;
  }
  return undefined;
}
