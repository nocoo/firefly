import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getHumanById } from "@/data/entities/human";

export default async function AuthorLayout({ children, params }: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (id !== "new" && !await getHumanById(getDb(), id)) notFound();
  return children;
}
