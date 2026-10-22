/** Read optional JSON body fields where explicit `null` must clear a column. */

export class BodyFieldTypeError extends Error {
  readonly field: string;

  constructor(field: string) {
    super(`Expected string or null for ${field}`);
    this.name = "BodyFieldTypeError";
    this.field = field;
  }
}

export function readOptionalBodyString(
  body: Record<string, unknown>,
  camelKey: string,
  snakeKey: string,
): string | null | undefined {
  if (Object.hasOwn(body, camelKey)) {
    const value = body[camelKey];
    if (value === null) return null;
    if (typeof value !== "string") throw new BodyFieldTypeError(camelKey);
    return value;
  }
  if (Object.hasOwn(body, snakeKey)) {
    const value = body[snakeKey];
    if (value === null) return null;
    if (typeof value !== "string") throw new BodyFieldTypeError(snakeKey);
    return value;
  }
  return undefined;
}
