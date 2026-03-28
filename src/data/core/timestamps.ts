// ---------------------------------------------------------------------------
// Timestamp and ID generation utilities
// ---------------------------------------------------------------------------

import { ulid } from "ulid";

/** Current time as Unix epoch seconds (integer). */
export function nowEpoch(): number {
  return Math.floor(Date.now() / 1000);
}

/** Generate a new ULID (26-char, Crockford Base32, time-sortable). */
export function newId(): string {
  return ulid();
}
