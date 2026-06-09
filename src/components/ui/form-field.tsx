import * as React from "react";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  id: string;
  label: React.ReactNode;
  /** Optional helper text below the label. */
  description?: React.ReactNode;
  /** Field-level error message; when set, the field is rendered in error state. */
  error?: string | null;
  /** The control(s) — typically an Input/Textarea. */
  children: React.ReactNode;
  className?: string;
}

/**
 * Vertical form field shell: label + (optional) description + control + (optional) error.
 *
 * Wires up `aria-describedby` linkage via `descriptionId`/`errorId` derived from `id`.
 * The control inside `children` is responsible for setting its own `id` and matching
 * `aria-invalid` / `aria-describedby` — FormField only provides the surrounding labels.
 */
export function FormField({
  id,
  label,
  description,
  error,
  children,
  className,
}: FormFieldProps) {
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {description && (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}
      {children}
      {error && (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
