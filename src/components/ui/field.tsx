"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn("text-[13px] font-medium leading-5 text-foreground", className)}
      {...props}
    />
  );
}

export interface FieldControlProps {
  id: string;
  "aria-describedby": string | undefined;
  "aria-invalid": true | undefined;
}

interface FieldProps {
  label: React.ReactNode;
  /** Help text under the control. Replaced by the error when there is one. */
  hint?: React.ReactNode;
  error?: string;
  optional?: boolean;
  /** Small element aligned to the right of the label. */
  aside?: React.ReactNode;
  className?: string;
  children: (control: FieldControlProps) => React.ReactNode;
}

/**
 * Label, control, hint and error with the accessibility wiring done:
 * the control is labelled, described by its hint or error, and flagged invalid.
 */
export function Field({ label, hint, error, optional, aside, className, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div data-slot="field" className={cn("grid gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>
          {label}
          {optional ? <span className="ml-1.5 font-normal text-faint">Optional</span> : null}
        </Label>
        {aside}
      </div>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {error ? (
        <p id={errorId} role="alert" className="text-[13px] leading-5 text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-[13px] leading-5 text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** A titled group of fields inside a form. */
export function FormSection({
  title,
  description,
  aside,
  className,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-xl border bg-surface shadow-xs", className)}>
      <header className="flex items-start justify-between gap-4 border-b px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold leading-6 tracking-[-0.01em]">{title}</h2>
          {description ? <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">{description}</p> : null}
        </div>
        {aside}
      </header>
      <div className="grid gap-5 px-4 py-5 sm:px-6">{children}</div>
    </section>
  );
}
