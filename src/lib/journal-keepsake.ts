export const keepsakeIds = ["gameboy", "nokia", "macintosh", "ipod", "garmin", "honda"] as const;
export type KeepsakeId = (typeof keepsakeIds)[number];

export function randomKeepsake(): KeepsakeId {
  return keepsakeIds[Math.floor(Math.random() * keepsakeIds.length)] as KeepsakeId;
}

// Document-scoped rather than React- or session-scoped: navigating back to the
// journal keeps the same object, while a full refresh makes a new choice.
export function documentKeepsake(doc: Document, initialScene: KeepsakeId): KeepsakeId {
  const saved = doc.documentElement.dataset.keepsake;
  if (keepsakeIds.some((id) => id === saved)) return saved as KeepsakeId;
  doc.documentElement.dataset.keepsake = initialScene;
  return initialScene;
}
