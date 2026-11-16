import {
  CircleCheck,
  CirclePause,
  Eye,
  EyeOff,
  type LucideIcon,
  PackagePlus,
  Pencil,
  Sparkles,
  Store,
  Tag,
  Trash2,
} from "lucide-react";
import { formatDate, formatRelative, formatTime } from "@/lib/format";
import type { Activity, ActivityAction } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACTIONS: Record<ActivityAction, { icon: LucideIcon; verb: string; tone: string }> = {
  business_created: { icon: Sparkles, verb: "created the storefront", tone: "bg-brand-soft text-brand-strong" },
  storefront_updated: { icon: Store, verb: "updated the storefront settings", tone: "bg-surface-3 text-muted-foreground" },
  device_added: { icon: PackagePlus, verb: "added", tone: "bg-success-soft text-success" },
  device_updated: { icon: Pencil, verb: "edited", tone: "bg-surface-3 text-muted-foreground" },
  device_sold: { icon: Tag, verb: "marked as sold", tone: "bg-foreground text-background" },
  device_reserved: { icon: CirclePause, verb: "reserved", tone: "bg-warning-soft text-warning" },
  device_available: { icon: CircleCheck, verb: "marked as available", tone: "bg-success-soft text-success" },
  device_deleted: { icon: Trash2, verb: "deleted", tone: "bg-danger-soft text-danger" },
  price_shown: { icon: Eye, verb: "made the price public for", tone: "bg-surface-3 text-muted-foreground" },
  price_hidden: { icon: EyeOff, verb: "hid the price of", tone: "bg-surface-3 text-muted-foreground" },
};

const STANDALONE: ActivityAction[] = ["business_created", "storefront_updated"];

/** A chronological list of what changed in the inventory, and who did it. */
export function ActivityFeed({
  entries,
  now,
  detailed = false,
  className,
}: {
  entries: Activity[];
  /** Current time, supplied by the server so labels match on both sides. */
  now: number;
  /** Show the exact date and time as well as the relative label. */
  detailed?: boolean;
  className?: string;
}) {
  return (
    <ol className={cn("grid", className)}>
      {entries.map((entry, index) => {
        const action = ACTIONS[entry.action];
        const standalone = STANDALONE.includes(entry.action);
        return (
          <li key={entry.id} className="relative flex gap-3 pb-5 last:pb-0">
            {index < entries.length - 1 ? (
              <span aria-hidden className="absolute bottom-0 left-[15px] top-8 w-px bg-border" />
            ) : null}
            <span className={cn("relative flex size-8 shrink-0 items-center justify-center rounded-full", action.tone)}>
              <action.icon aria-hidden className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm leading-5">
                <span className="font-medium">{entry.performedByName}</span>{" "}
                <span className="text-muted-foreground">{action.verb}</span>
                {standalone ? null : (
                  <>
                    {" "}
                    <span className="font-medium">{entry.subject}</span>
                  </>
                )}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs leading-5 text-faint">
                <time dateTime={entry.timestamp}>
                  {detailed
                    ? `${formatDate(entry.timestamp)}, ${formatTime(entry.timestamp)}`
                    : formatRelative(entry.timestamp, now)}
                </time>
                {entry.reference ? <span className="font-mono">{entry.reference}</span> : null}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
