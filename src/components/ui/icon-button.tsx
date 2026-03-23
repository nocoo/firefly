import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type IconButtonSize = "sm" | "md" | "lg";

const sizeClasses: Record<IconButtonSize, string> = {
  sm: "h-7 w-7",
  md: "h-8 w-8",
  lg: "h-10 w-10",
};

interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: IconButtonSize;
}

/**
 * Minimal icon-only button with consistent sizing and hover states.
 * Replaces the repeated `flex h-8 w-8 items-center justify-center rounded-lg ...`
 * pattern across shell, sidebar, theme toggle, and locale toggle.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors",
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  ),
);

IconButton.displayName = "IconButton";
