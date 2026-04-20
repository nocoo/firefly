// ---------------------------------------------------------------------------
// Timestamp and ID generation utilities
// ---------------------------------------------------------------------------

/** Current time as Unix epoch seconds (integer). */
export function nowEpoch(): number {
  return Math.floor(Date.now() / 1000);
}

/** Generate a new UUID v4 (36-char, lowercase, unique). */
export function newId(): string {
  return crypto.randomUUID();
}
