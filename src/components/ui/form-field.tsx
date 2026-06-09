import * as React from "react";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  id: string;
  label: React.ReactNode;
  /** Optional helper text below the label. */
  description?: React.ReactNode;
  /** Field-level error message; when set, the field is rendered in error state. */
  error?: string | null;
  /**
   * The control. Must be a single React element accepting `id`,
   * `aria-describedby`, and `aria-invalid` props (Input/Textarea/Select all do).
   * FormField clones it and wires those attributes — caller no longer needs to
   * thread them by hand.
   */
  children: React.ReactElement<{
    id?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
    className?: string;
  }>;
  className?: string;
}

/**
 * Vertical form field shell: label + (optional) description + control + (optional) error.
 *
 * Wires `id`, `aria-describedby`, and `aria-invalid` onto the (single) child
 * control so the caller doesn't have to repeat those attributes per field. The
 * control is responsible for being a real form element that accepts those
 * props (Input, Textarea, Select).
 *
 * `aria-describedby` joins the description and error ids when both are set, so
 * screen readers announce the helper text and the failure together.
 */
export function FormField({
  id,
  label,
  description,
  error,
  children,
  className,
}: FormFieldProps) {
  // If the child already declares its own id, label must point at THAT —
  // otherwise <label htmlFor> dangles to a non-existent element. The
  // description/error ids piggyback on the same effective id so all three
  // (label, helper, error) stay anchored to the same control.
  const controlId = children.props.id ?? id;
  const descriptionId = description ? `${controlId}-description` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy =
    [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  const existingClassName = children.props.className;
  const errorClassName = error
    ? cn(existingClassName, "border-destructive")
    : existingClassName;

  const mergedDescribedBy =
    [children.props["aria-describedby"], describedBy]
      .filter(Boolean)
      .join(" ") || undefined;

  const cloneProps: {
    id: string;
    className?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  } = {
    id: controlId,
  };
  if (errorClassName) cloneProps.className = errorClassName;
  if (mergedDescribedBy) cloneProps["aria-describedby"] = mergedDescribedBy;
  if (error) cloneProps["aria-invalid"] = true;
  else if (children.props["aria-invalid"] !== undefined)
    cloneProps["aria-invalid"] = children.props["aria-invalid"];

  const control = React.cloneElement(children, cloneProps);

  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={controlId} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {description && (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}
      {control}
      {error && (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
