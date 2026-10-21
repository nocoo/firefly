import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getAiAgentById } from "@/data/entities/ai-agent";

export default async function AiAgentLayout({ children, params }: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (id !== "new" && !await getAiAgentById(getDb(), id)) notFound();
  return children;
}
