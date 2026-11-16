import { cn } from "@/lib/utils";

/** Shared look for text-like controls. 16px text on phones avoids iOS zoom. */
export const controlClasses = cn(
  "w-full min-w-0 rounded-md border border-border-strong/80 bg-surface text-base text-foreground shadow-xs outline-none",
  "transition-[border-color,box-shadow,background-color] duration-150",
  "placeholder:text-faint",
  "hover:border-border-strong",
  "focus-visible:border-foreground/45 focus-visible:ring-4 focus-visible:ring-ring/15",
  "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted-foreground disabled:opacity-80",
  "aria-invalid:border-danger aria-invalid:ring-danger/15",
  "md:text-sm",
);

export function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return <input data-slot="input" type={type} className={cn(controlClasses, "h-11 px-3 md:h-10", className)} {...props} />;
}

export function Textarea({ className, rows = 3, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      rows={rows}
      className={cn(controlClasses, "min-h-20 resize-y px-3 py-2.5 leading-6", className)}
      {...props}
    />
  );
}

interface AffixInputProps extends React.ComponentProps<"input"> {
  /** Static text or icon shown before the value, for example "₹" or "+91". */
  prefix?: string;
  leading?: React.ReactNode;
  suffix?: string;
  trailing?: React.ReactNode;
  wrapperClassName?: string;
}

/** An input with a fixed adornment on either side. */
export function AffixInput({
  className,
  wrapperClassName,
  prefix,
  leading,
  suffix,
  trailing,
  type = "text",
  ...props
}: AffixInputProps) {
  const invalid = props["aria-invalid"] === true || props["aria-invalid"] === "true";
  return (
    <div
      data-slot="affix-input"
      data-invalid={invalid || undefined}
      className={cn(
        "flex h-11 w-full min-w-0 items-center rounded-md border border-border-strong/80 bg-surface shadow-xs md:h-10",
        "transition-[border-color,box-shadow] duration-150 hover:border-border-strong",
        "focus-within:border-foreground/45 focus-within:ring-4 focus-within:ring-ring/15",
        "data-invalid:border-danger data-invalid:ring-danger/15",
        "has-[:disabled]:bg-surface-2 has-[:disabled]:opacity-80",
        wrapperClassName,
      )}
    >
      {leading ? <span className="flex shrink-0 items-center pl-3 text-muted-foreground">{leading}</span> : null}
      {prefix ? (
        <span className="shrink-0 select-none pl-3 text-base text-muted-foreground md:text-sm">{prefix}</span>
      ) : null}
      <input
        type={type}
        className={cn(
          "h-full w-full min-w-0 bg-transparent px-3 text-base text-foreground outline-none placeholder:text-faint md:text-sm",
          "disabled:cursor-not-allowed",
          (prefix || leading) && "pl-2",
          (suffix || trailing) && "pr-2",
          className,
        )}
        {...props}
      />
      {suffix ? (
        <span className="shrink-0 select-none pr-3 text-base text-muted-foreground md:text-sm">{suffix}</span>
      ) : null}
      {trailing ? <span className="flex shrink-0 items-center pr-1.5">{trailing}</span> : null}
    </div>
  );
}
