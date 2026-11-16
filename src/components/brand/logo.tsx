import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * The mark is an "on" indicator: a ring with a lit centre. It reads as a
 * selected state, an availability light and a camera lens at the same time.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={cn("size-6", className)}>
      <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="12" cy="12" r="4.25" fill="var(--brand)" />
    </svg>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-foreground", className)}>
      <LogoMark className={markClassName} />
      <span className="text-[17px] font-semibold leading-none tracking-[-0.035em]">{site.name.toLowerCase()}</span>
    </span>
  );
}
