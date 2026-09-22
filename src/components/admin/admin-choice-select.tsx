"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  type SelectSize,
} from "@nocoo/basalt/components/select";

/** Radix SelectItem rejects "". Domain code keeps "" for empty choices. */
const EMPTY = "__empty__";
const UNSELECTED = "__unselected__";

export function AdminChoiceSelect({
  id,
  value,
  onValueChange,
  options,
  disabled,
  className,
  size = "default",
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  className?: string;
  size?: SelectSize;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const hasEmpty = options.some((option) => option.value === "");
  const selected = value === "" ? (hasEmpty ? EMPTY : UNSELECTED) : value;

  return (
    <Select
      value={selected}
      onValueChange={(next) => {
        if (next === EMPTY || next === UNSELECTED) {
          onValueChange("");
          return;
        }
        onValueChange(next);
      }}
      {...(disabled ? { disabled: true } : {})}
    >
      <SelectTrigger
        id={id}
        size={size}
        className={className}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => {
          const itemValue = option.value === "" ? EMPTY : option.value;
          return (
            <SelectItem key={itemValue} value={itemValue}>
              {option.label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
