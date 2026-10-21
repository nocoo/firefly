import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getPostById } from "@/data/entities/post";

export default async function EditPostLayout({ children, params }: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Resolve missing resources before loading.tsx can commit a streamed 200.
  if (!await getPostById(getDb(), id)) notFound();
  return children;
}
