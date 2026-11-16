"use client";

import { useNow } from "@/lib/hooks";
import { getOpenStatus } from "@/lib/hours";
import type { BusinessHours } from "@/lib/types";
import { cn } from "@/lib/utils";

/** "Open now · Closes 9:00 PM", kept current while the page stays open. */
export function OpenStatus({
  hours,
  serverNow,
  className,
}: {
  hours: BusinessHours | null;
  serverNow: number;
  className?: string;
}) {
  const now = useNow(serverNow);
  const status = getOpenStatus(hours, now);
  if (!status) return null;

  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", className)}>
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          status.isOpen ? "animate-pulse-dot bg-success-dot text-success-dot" : "bg-current opacity-50",
        )}
      />
      <span className="font-medium">{status.label}</span>
      {status.detail ? <span className="opacity-75">· {status.detail}</span> : null}
    </span>
  );
}
