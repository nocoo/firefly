import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export interface EmptyStateAction {
  label: string;
  href: string;
}

interface EmptyStateProps {
  icon: LucideIcon;
  message: string;
  /** Optional secondary CTA below the message — e.g. "返回首页". */
  action?: EmptyStateAction;
  /** Optional second CTA on the same row as `action`. */
  secondaryAction?: EmptyStateAction;
  /**
   * `blog` (default): muted text on blog surface — used in list pages.
   * `admin`: foreground muted on admin surface — used in tables/grids.
   */
  variant?: "blog" | "admin";
}

/**
 * Shared empty state — icon + short message, optional action links.
 *
 * Used in both blog list pages and admin tables/grids; pass
 * `variant="admin"` to switch the muted color token.
 */
export function EmptyState({
  icon: Icon,
  message,
  action,
  secondaryAction,
  variant = "blog",
}: EmptyStateProps) {
  const colorClass =
    variant === "admin" ? "text-muted-foreground" : "text-blog-muted";
  const linkClass =
    variant === "admin"
      ? "text-primary hover:underline"
      : "text-blog-text underline decoration-blog-accent decoration-2 underline-offset-4 hover:decoration-blog-text";
  const secondaryLinkClass =
    variant === "admin"
      ? "text-muted-foreground hover:text-foreground"
      : "text-blog-muted hover:text-blog-text";

  return (
    <div className={`flex flex-col items-center gap-3 py-16 ${colorClass}`}>
      <Icon className="h-8 w-8 opacity-40" strokeWidth={1.5} />
      <p className="text-sm">{message}</p>
      {action && (
        <div className="flex flex-wrap items-center justify-center gap-3 font-mono text-sm">
          <Link href={action.href} className={linkClass}>
            {action.label}
          </Link>
          {secondaryAction && (
            <>
              <span aria-hidden="true">·</span>
              <Link
                href={secondaryAction.href}
                className={secondaryLinkClass}
              >
                {secondaryAction.label}
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
