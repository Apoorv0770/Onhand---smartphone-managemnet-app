import { Images } from "lucide-react";
import Link from "next/link";
import { BatteryBadge, StatusBadge } from "@/components/device/badges";
import { DeviceVisual } from "@/components/device/device-visual";
import { CONDITION_LABEL } from "@/lib/catalog";
import { devicePath, deviceSpecLine, deviceTitle } from "@/lib/device";
import { formatPrice } from "@/lib/format";
import type { PublicDevice } from "@/lib/types";
import { cn } from "@/lib/utils";

/** The body of a catalog card, shared by the live storefront and previews. */
export function DeviceCardBody({
  device,
  eager = false,
  showCondition = true,
}: {
  device: PublicDevice;
  eager?: boolean;
  /** Off while a form has no condition chosen yet, so the preview never guesses one. */
  showCondition?: boolean;
}) {
  const sold = device.availability === "sold";
  const title = deviceTitle(device);

  return (
    <>
      <div className="relative">
        <DeviceVisual
          brand={device.brand}
          model={device.model}
          colour={device.colour}
          imageUrl={device.images[0]?.url}
          alt={`${title}, ${device.colour}`}
          loading={eager ? "eager" : "lazy"}
          inset="p-[8.5%] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.045]"
          className={cn("aspect-[10/11]", sold && "opacity-60 saturate-[0.15]")}
        />
        <StatusBadge status={device.availability} size="sm" solid className="absolute left-2.5 top-2.5" />
        {device.images.length > 1 ? (
          <span className="tnum absolute bottom-2.5 right-2.5 inline-flex h-5 items-center gap-1 rounded-full bg-foreground/70 px-2 text-2xs font-medium text-white backdrop-blur-sm">
            <Images aria-hidden className="size-3" />
            {device.images.length}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <p className="eyebrow text-faint">{device.brand}</p>
        <h3
          className={cn(
            "mt-1 text-[15px] font-semibold leading-5 tracking-[-0.015em] sm:text-base",
            sold && "text-muted-foreground",
          )}
        >
          {device.model}
        </h3>
        <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">{deviceSpecLine(device)}</p>

        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
          {device.batteryHealth !== null ? <BatteryBadge health={device.batteryHealth} className="text-foreground" /> : null}
          {showCondition ? <span>{CONDITION_LABEL[device.condition]}</span> : null}
        </div>

        <div className="mt-auto pt-3">
          {device.price !== null ? (
            <p className="tnum text-[17px] font-semibold leading-6 tracking-[-0.02em]">{formatPrice(device.price)}</p>
          ) : sold ? (
            <p className="text-[13px] leading-6 text-faint">No longer available</p>
          ) : (
            <p className="text-[13px] leading-6 text-muted-foreground">Price on request</p>
          )}
        </div>
      </div>
    </>
  );
}

export const deviceCardClasses = cn(
  "group relative flex flex-col overflow-hidden rounded-2xl border bg-surface shadow-xs outline-offset-4",
  "transition-[border-color,box-shadow,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
  "hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md",
);

/** One phone in the catalog grid. The whole card links to its detail page. */
export function DeviceCard({
  device,
  shopSlug,
  eager = false,
  className,
}: {
  device: PublicDevice;
  shopSlug: string;
  eager?: boolean;
  className?: string;
}) {
  return (
    <Link href={devicePath(shopSlug, device)} className={cn(deviceCardClasses, className)}>
      <DeviceCardBody device={device} eager={eager} />
    </Link>
  );
}
