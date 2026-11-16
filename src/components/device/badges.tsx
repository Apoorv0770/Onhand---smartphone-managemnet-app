import { BatteryFull, BatteryLow, BatteryMedium } from "lucide-react";
import { AVAILABILITY_LABEL, CONDITION_LABEL } from "@/lib/catalog";
import { batteryTone } from "@/lib/device";
import type { AvailabilityStatus, DeviceCondition } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<AvailabilityStatus, { badge: string; dot: string }> = {
  available: { badge: "bg-success-soft text-success", dot: "bg-success-dot text-success-dot" },
  reserved: { badge: "bg-warning-soft text-warning", dot: "bg-warning-dot" },
  sold: { badge: "bg-surface-3 text-muted-foreground", dot: "bg-faint" },
};

/** Availability pill. The dot gently pulses only while a phone is in stock. */
export function StatusBadge({
  status,
  size = "md",
  solid = false,
  className,
}: {
  status: AvailabilityStatus;
  size?: "sm" | "md";
  /** Opaque background for use on top of photos. */
  solid?: boolean;
  className?: string;
}) {
  const styles = STATUS_STYLES[status];
  return (
    <span
      data-status={status}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-medium",
        size === "sm" ? "h-5 px-2 text-2xs" : "h-6 px-2.5 text-xs",
        solid ? "bg-surface/95 text-foreground shadow-xs ring-1 ring-foreground/6 backdrop-blur-sm" : styles.badge,
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("size-1.5 rounded-full", styles.dot, status === "available" && "animate-pulse-dot")}
      />
      {AVAILABILITY_LABEL[status]}
    </span>
  );
}

export function ConditionBadge({ condition, className }: { condition: DeviceCondition; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full border bg-surface px-2.5 text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      {CONDITION_LABEL[condition]}
    </span>
  );
}

const BATTERY_TONE: Record<ReturnType<typeof batteryTone>, string> = {
  good: "text-success",
  ok: "text-warning",
  low: "text-danger",
};

/** Battery health as reported by the phone. Rendered only when known. */
export function BatteryBadge({
  health,
  className,
  showLabel = false,
}: {
  health: number;
  className?: string;
  showLabel?: boolean;
}) {
  const tone = batteryTone(health);
  const Icon = tone === "good" ? BatteryFull : tone === "ok" ? BatteryMedium : BatteryLow;
  return (
    <span
      className={cn("tnum inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-medium", className)}
      title={`Battery health ${health}%`}
    >
      <Icon aria-hidden className={cn("size-4", BATTERY_TONE[tone])} />
      <span className="sr-only">Battery health </span>
      {health}%{showLabel ? <span className="font-normal text-muted-foreground"> battery</span> : null}
    </span>
  );
}
