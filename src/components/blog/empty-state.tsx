import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  message: string;
}

/** Shared empty state for list pages — icon + short message, centered. */
export function EmptyState({ icon: Icon, message }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-blog-muted">
      <Icon className="h-8 w-8 opacity-40" strokeWidth={1.5} />
      <p className="text-sm">{message}</p>
    </div>
  );
}
