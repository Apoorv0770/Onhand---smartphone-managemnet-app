import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

export const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap font-medium",
    "transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-150 ease-out",
    "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
    "aria-disabled:pointer-events-none aria-disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover",
        secondary:
          "border border-border-strong/80 bg-surface text-foreground shadow-xs hover:border-border-strong hover:bg-surface-2",
        ghost: "text-foreground hover:bg-surface-3",
        subtle: "bg-surface-3 text-foreground hover:bg-border",
        accent: "bg-brand-strong text-brand-foreground shadow-xs hover:bg-brand",
        whatsapp: "bg-whatsapp text-whatsapp-foreground shadow-xs hover:bg-whatsapp-hover",
        danger: "bg-danger text-white shadow-xs hover:opacity-90",
        "danger-ghost": "text-danger hover:bg-danger-soft",
        link: "h-auto rounded-none p-0 text-brand-strong underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        sm: "h-8 rounded-sm px-3 text-[13px]",
        md: "h-10 rounded-md px-4 text-sm",
        lg: "h-12 rounded-lg px-5 text-[15px]",
        "icon-sm": "size-8 rounded-sm",
        icon: "size-10 rounded-md",
        "icon-lg": "size-12 rounded-lg",
      },
    },
    compoundVariants: [{ variant: "link", className: "h-auto px-0" }],
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  /** Render the child element (for example a Link) with button styling. */
  asChild?: boolean;
  /** Shows a spinner and blocks interaction while work is in progress. */
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  type,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);

  if (asChild) {
    return (
      <Slot.Root data-slot="button" className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      data-slot="button"
      type={type ?? "button"}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}
