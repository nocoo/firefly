"use client";

import { useSyncExternalStore } from "react";
import { documentKeepsake, type KeepsakeId } from "@/lib/journal-keepsake";

const subscribe = () => () => undefined;
export function JournalKeepsake({ initialScene }: { initialScene: KeepsakeId }) {
  // The first HTML and hydration use the same server-selected image. Later
  // client navigation reuses the document's choice before its first render.
  const scene = useSyncExternalStore(
    subscribe,
    () => documentKeepsake(document, initialScene),
    () => initialScene,
  );
  return (
    <img
      className="journal-keepsake"
      data-keepsake={scene}
      src={`/journal-keepsakes/${scene}.svg`}
      width={256}
      height={280}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}
