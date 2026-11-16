import { cn } from "@/lib/utils";

/**
 * Shown wherever there is nothing to list yet. Always says what is missing
 * and offers the next useful action.
 */
export function EmptyState({
  icon,
  title,
  description,
  children,
  className,
  compact = false,
}: {
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  /** Action buttons. */
  children?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "relative isolate flex flex-col items-center overflow-hidden rounded-2xl border border-dashed border-border-strong/80 bg-surface/60 px-6 text-center",
        compact ? "py-10" : "py-16 sm:py-20",
        className,
      )}
    >
      <div aria-hidden className="bg-dots mask-fade-edges absolute inset-0 -z-10 opacity-70" />
      <div className="flex size-12 items-center justify-center rounded-xl border bg-surface text-muted-foreground shadow-sm [&_svg]:size-5">
        {icon}
      </div>
      <h3 className="mt-5 text-base font-semibold tracking-[-0.01em]">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
      {children ? <div className="mt-6 flex flex-wrap items-center justify-center gap-2">{children}</div> : null}
    </div>
  );
}
