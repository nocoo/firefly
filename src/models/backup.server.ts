import "server-only";
import { randomUUID } from "node:crypto";

/**
 * Generate a cryptographically random pull webhook key.
 * Server-only — relies on Node.js `crypto` module.
 */
export function generatePullWebhookKey(): string {
  return randomUUID();
}
