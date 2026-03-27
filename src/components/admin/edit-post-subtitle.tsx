"use client";

import { useSetPageSubtitle } from "@/components/admin/page-subtitle-context";

export function EditPostSubtitle({ title }: { title: string }) {
  useSetPageSubtitle(title);
  return null;
}
