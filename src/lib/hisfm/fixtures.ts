/** Shared his.fm card v1 fixtures (recorded from live /api/card; tests must not fetch). */

import ep02 from "./fixtures/ep02-published.json";
import ep03 from "./fixtures/ep03-published.json";
import type { HisFmPublishedCard } from "./card-schema";

export const FIXTURE_EPISODE_URL_EP02 =
  "https://his.fm/episodes/manager-notes/same-mindset-makes-expansion-pointless";

export const FIXTURE_EPISODE_URL_EP03 =
  "https://his.fm/episodes/manager-notes/what-the-reorg-did-not-write";

/** @deprecated use fixtureEp02Published */
export const FIXTURE_EPISODE_URL = FIXTURE_EPISODE_URL_EP02;

export function fixtureEp02Published(): HisFmPublishedCard {
  return ep02 as HisFmPublishedCard;
}

export function fixtureEp03Published(): HisFmPublishedCard {
  return ep03 as HisFmPublishedCard;
}

export function mockHisFmCardPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return { ...ep02, ...overrides };
}
