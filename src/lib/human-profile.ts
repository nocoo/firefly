import { createHash } from "node:crypto";
import type { Human } from "@/models/types";
import { normalizeHumanEmail } from "@/data/entities/human";
import { getHumanAvatarUrl } from "@/lib/human-avatar";

export interface ProfileLookup {
  kind: "none" | "email" | "hash";
  value: string | null;
}

export interface PublicProfile {
  name: string | null;
  avatar: string | null;
}

const HASH_RE = /^[0-9a-f]{64}$/;

export function hashNormalizedEmail(email: string): string {
  return createHash("sha256").update(email).digest("hex");
}

export function parseProfileQuery(
  email: string | null,
  hash: string | null,
): ProfileLookup {
  if (hash !== null && hash !== "") {
    if (!HASH_RE.test(hash)) return { kind: "none", value: null };
    return { kind: "hash", value: hash };
  }
  const normalized = normalizeHumanEmail(email);
  if (!normalized) return { kind: "none", value: null };
  return { kind: "email", value: normalized };
}

export function toPublicProfile(human: Human | null): PublicProfile {
  if (!human) return { name: null, avatar: null };
  return {
    name: human.name,
    avatar: getHumanAvatarUrl(human.id, human.avatar_version, 80),
  };
}

export function findPublicProfile(
  humans: Human[],
  lookup: ProfileLookup,
): PublicProfile {
  if (lookup.kind === "none" || !lookup.value) {
    return { name: null, avatar: null };
  }

  const match = humans.find((human) => {
    if (!human.email || human.profile_public !== 1) return false;
    if (lookup.kind === "email") return human.email === lookup.value;
    return hashNormalizedEmail(human.email) === lookup.value;
  });

  return toPublicProfile(match ?? null);
}
