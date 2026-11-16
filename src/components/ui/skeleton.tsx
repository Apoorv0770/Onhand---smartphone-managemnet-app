import { cn } from "@/lib/utils";

/** Placeholder block shown while content loads. Hidden from assistive tech. */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div aria-hidden data-slot="skeleton" className={cn("skeleton", className)} {...props} />;
}

/** Wraps a group of skeletons with a single polite loading announcement. */
export function LoadingRegion({
  label = "Loading",
  className,
  children,
}: {
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
