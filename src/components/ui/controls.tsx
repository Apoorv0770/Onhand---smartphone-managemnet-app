"use client";

import { Check } from "lucide-react";
import {
  Checkbox as CheckboxPrimitive,
  Slider as SliderPrimitive,
  Switch as SwitchPrimitive,
  ToggleGroup as ToggleGroupPrimitive,
} from "radix-ui";
import { cn } from "@/lib/utils";

/* --------------------------------- Switch --------------------------------- */

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-border-strong outline-none",
        "transition-colors duration-200 focus-visible:ring-4 focus-visible:ring-ring/25",
        "data-[state=checked]:bg-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block size-5 rounded-full bg-white shadow-sm ring-0",
          "transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

/** A switch with its label and description as one large tap target. */
export function SwitchRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  className,
}: {
  id: string;
  label: string;
  description?: React.ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <label htmlFor={id} className="grid min-w-0 cursor-pointer gap-0.5">
        <span className="text-sm font-medium leading-5">{label}</span>
        {description ? <span className="text-[13px] leading-5 text-muted-foreground">{description}</span> : null}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}

/* -------------------------------- Checkbox -------------------------------- */

export function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer flex size-[18px] shrink-0 cursor-pointer items-center justify-center rounded-[5px] border border-border-strong bg-surface shadow-xs outline-none",
        "transition-colors duration-150 focus-visible:ring-4 focus-visible:ring-ring/25",
        "data-[state=checked]:border-foreground data-[state=checked]:bg-foreground data-[state=checked]:text-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <Check className="size-3.5" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

/* --------------------------------- Slider --------------------------------- */

export function Slider({
  className,
  thumbLabels,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & { thumbLabels: string[] }) {
  const count = (props.value ?? props.defaultValue ?? [0]).length;
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn("relative flex h-6 w-full touch-none select-none items-center", className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-surface-3">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-foreground" />
      </SliderPrimitive.Track>
      {Array.from({ length: count }, (_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          aria-label={thumbLabels[index] ?? thumbLabels[0]}
          className={cn(
            "block size-6 cursor-grab rounded-full border border-border-strong bg-white shadow-sm outline-none",
            "transition-[box-shadow,transform] duration-150 hover:scale-105 active:cursor-grabbing",
            "focus-visible:ring-4 focus-visible:ring-ring/30",
          )}
        />
      ))}
    </SliderPrimitive.Root>
  );
}

/* ---------------------------- Segmented control --------------------------- */

interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  /** Small count or note shown after the label. */
  meta?: React.ReactNode;
}

export function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  label,
  size = "md",
  className,
  stretch = false,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: SegmentedOption<T>[];
  /** Accessible name for the group. */
  label: string;
  size?: "sm" | "md";
  className?: string;
  stretch?: boolean;
}) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next) onValueChange(next as T);
      }}
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg bg-surface-3 p-0.5",
        stretch && "flex w-full",
        className,
      )}
    >
      {options.map((option) => (
        <ToggleGroupPrimitive.Item
          key={option.value}
          value={option.value}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[9px] font-medium text-muted-foreground outline-none",
            "transition-[background-color,color,box-shadow] duration-150 hover:text-foreground",
            "focus-visible:ring-4 focus-visible:ring-ring/25",
            "data-[state=on]:bg-surface data-[state=on]:text-foreground data-[state=on]:shadow-sm",
            size === "sm" ? "h-8 px-2.5 text-[13px]" : "h-9 px-3 text-sm",
            stretch && "flex-1",
          )}
        >
          {option.label}
          {option.meta !== undefined ? (
            <span className="tnum text-xs font-normal text-faint">{option.meta}</span>
          ) : null}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  );
}

/* ---------------------------------- Chip ---------------------------------- */

/** A toggleable pill used for filters and multi-select options. */
export function Chip({
  selected = false,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & { selected?: boolean }) {
  return (
    <button
      type="button"
      data-slot="chip"
      aria-pressed={selected}
      className={cn(
        "inline-flex h-9 shrink-0 select-none items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium",
        "transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97]",
        selected
          ? "border-foreground bg-foreground text-background"
          : "border-border-strong/70 bg-surface text-foreground hover:border-border-strong hover:bg-surface-2",
        "disabled:pointer-events-none disabled:opacity-45",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
