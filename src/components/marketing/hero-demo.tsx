"use client";

import { MapPin, Search } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { LogoMark } from "@/components/brand/logo";
import { BatteryBadge, StatusBadge } from "@/components/device/badges";
import { DeviceRender, tileTint } from "@/components/device/device-render";
import { deviceSpecLine, deviceTitle } from "@/lib/device";
import { formatPrice } from "@/lib/format";
import type { PublicDevice } from "@/lib/types";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------------------
   Hero illustration: the dashboard on the left, a customer's phone on the
   right. Every few seconds a phone is "marked sold" in the dashboard and the
   storefront updates with it. That link between the two is the whole product.
   Built from the same pieces the real app uses; decorative, so hidden from
   assistive tech. It holds still when reduced motion is requested.
--------------------------------------------------------------------------- */

/** Frames of the loop: which rows are sold, and which button is being pressed. */
const FRAMES: { sold: number[]; pressing: number | null }[] = [
  { sold: [], pressing: null },
  { sold: [], pressing: 1 },
  { sold: [1], pressing: null },
  { sold: [1], pressing: 3 },
  { sold: [1, 3], pressing: null },
  { sold: [1, 3], pressing: null },
];
const FRAME_MS = [2600, 520, 2400, 520, 2600, 900];

function Tile({ device, className, sold }: { device: PublicDevice; className?: string; sold?: boolean }) {
  const tint = tileTint(device.colour, device.brand);
  return (
    <div
      className={cn("flex items-center justify-center overflow-hidden transition-[filter,opacity] duration-500", sold && "opacity-60 saturate-[0.15]", className)}
      style={{ backgroundImage: `radial-gradient(125% 90% at 50% 0%, ${tint.from} 0%, ${tint.to} 100%)` }}
    >
      <DeviceRender brand={device.brand} model={device.model} colour={device.colour} className="h-[82%]" />
    </div>
  );
}

export function HeroDemo({ devices }: { devices: PublicDevice[] }) {
  const reduceMotion = useReducedMotion();
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setTimeout(() => setFrame((current) => (current + 1) % FRAMES.length), FRAME_MS[frame]);
    return () => window.clearTimeout(id);
  }, [frame, reduceMotion]);

  const { sold, pressing } = FRAMES[reduceMotion ? 2 : frame];
  const rows = devices.slice(0, 6);
  const cards = devices.slice(0, 4);
  const availableCount = 13 - sold.length;

  return (
    <div aria-hidden className="relative mx-auto w-full max-w-5xl select-none md:pt-10">
      {/* Dashboard window */}
      <div className="hidden overflow-hidden rounded-2xl border bg-surface shadow-lg md:mr-[30%] md:block lg:mr-[24%]">
        <div className="flex h-10 items-center gap-3 border-b bg-surface-2 px-4">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-border-strong" />
            <span className="size-2.5 rounded-full bg-border-strong" />
            <span className="size-2.5 rounded-full bg-border-strong" />
          </div>
          <div className="flex h-6 flex-1 items-center justify-center rounded-md bg-surface px-3 font-mono text-2xs text-faint ring-1 ring-border">
            dashboard / inventory
          </div>
          <div className="w-10" />
        </div>
        <div className="flex">
          <div className="hidden w-40 shrink-0 border-r bg-surface-2 p-3 lg:block">
            <div className="flex items-center gap-2 px-1">
              <LogoMark className="size-4" />
              <span className="text-xs font-semibold tracking-tight">onhand</span>
            </div>
            <div className="mt-4 grid gap-1 text-xs">
              <span className="rounded-md px-2 py-1.5 text-muted-foreground">Overview</span>
              <span className="rounded-md bg-surface px-2 py-1.5 font-medium shadow-xs ring-1 ring-border">Inventory</span>
              <span className="rounded-md px-2 py-1.5 text-muted-foreground">Storefront</span>
              <span className="rounded-md px-2 py-1.5 text-muted-foreground">Activity</span>
            </div>
          </div>
          <div className="min-w-0 flex-1 p-4 lg:p-5">
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold tracking-tight">Inventory</p>
              <span className="rounded-md bg-primary px-2.5 py-1.5 text-2xs font-medium text-primary-foreground">+ Add device</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex items-center gap-0.5 rounded-lg bg-surface-3 p-0.5 text-2xs font-medium">
                <span className="rounded-md bg-surface px-2 py-1 shadow-xs">
                  All <span className="tnum font-normal text-faint">16</span>
                </span>
                <span className="px-2 py-1 text-muted-foreground">
                  Available <span className="tnum font-normal text-faint">{availableCount}</span>
                </span>
                <span className="px-2 py-1 text-muted-foreground">
                  Sold <span className="tnum font-normal text-faint">{2 + sold.length}</span>
                </span>
              </div>
              <div className="hidden h-7 flex-1 items-center gap-1.5 rounded-md border bg-surface px-2.5 text-2xs text-faint lg:flex">
                <Search className="size-3" />
                Search model, colour, reference
              </div>
            </div>
            <div className="mt-3 overflow-hidden rounded-xl border">
              {rows.map((device, index) => {
                const isSold = sold.includes(index);
                const isPressing = pressing === index;
                return (
                  <div
                    key={device.id}
                    className={cn(
                      "flex items-center gap-3 border-b px-3 py-2 transition-colors duration-500 last:border-b-0",
                      isSold && "bg-surface-2/70",
                    )}
                  >
                    <Tile device={device} sold={isSold} className="size-9 shrink-0 rounded-md border" />
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-xs font-medium transition-colors", isSold && "text-muted-foreground")}>
                        {deviceTitle(device)}
                      </p>
                      <p className="truncate text-2xs text-muted-foreground">{deviceSpecLine(device)}</p>
                    </div>
                    <span className="tnum hidden text-xs font-medium sm:block">
                      {device.price !== null ? formatPrice(device.price) : ""}
                    </span>
                    <span className="flex w-[4.75rem] justify-start">
                      <StatusBadge status={isSold ? "sold" : "available"} size="sm" />
                    </span>
                    <span
                      className={cn(
                        "flex h-7 w-[5.75rem] items-center justify-center rounded-md border text-2xs font-medium shadow-xs transition-[transform,background-color,border-color,box-shadow] duration-200",
                        isPressing
                          ? "scale-95 border-foreground bg-surface-3 ring-4 ring-ring/20"
                          : "border-border-strong/80 bg-surface",
                      )}
                    >
                      {isSold ? "Mark available" : "Mark sold"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Customer's phone */}
      <div className="relative mx-auto w-[16.5rem] md:absolute md:-bottom-10 md:right-0 md:mx-0 lg:-bottom-14 lg:w-[17.5rem]">
        <div className="rounded-[2.6rem] bg-foreground p-2 shadow-lg ring-1 ring-black/10">
          <div className="overflow-hidden rounded-[2.1rem] bg-background">
            <div
              className="relative px-3.5 pb-3.5 pt-9 text-white"
              style={{
                background:
                  "radial-gradient(120% 140% at 85% -20%, #4a4640 0%, transparent 55%), radial-gradient(90% 120% at 0% 110%, #3a2a22 0%, transparent 60%), linear-gradient(160deg, #262523 0%, #171615 100%)",
              }}
            >
              <span className="absolute left-1/2 top-2 h-4 w-16 -translate-x-1/2 rounded-full bg-black/70" />
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-xl bg-[#2f4329] text-2xs font-semibold text-[#eaf3e2] ring-1 ring-white/20">
                  UM
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold leading-4 tracking-tight">Urban Mobile Studio</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[9px] leading-3 opacity-80">
                    <MapPin className="size-2.5" />
                    Rajkamal Square, Amravati
                  </p>
                </div>
              </div>
            </div>
            <div className="px-3 pb-4 pt-3">
              <div className="flex items-baseline justify-between">
                <p className="text-xs font-semibold tracking-tight">Phones in stock</p>
                <p className="tnum text-[9px] text-muted-foreground transition-all">{availableCount} available</p>
              </div>
              <div className="mt-2 flex h-7 items-center gap-1.5 rounded-full border bg-surface px-2.5 text-[10px] text-faint shadow-xs">
                <Search className="size-3" />
                Search phones
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                {cards.map((device, index) => {
                  const isSold = sold.includes(index);
                  return (
                    <div key={device.id} className="overflow-hidden rounded-xl border bg-surface">
                      <div className="relative">
                        <Tile device={device} sold={isSold} className="aspect-[10/10.5]" />
                        <span
                          className={cn(
                            "absolute left-1.5 top-1.5 inline-flex h-4 items-center gap-1 rounded-full bg-surface/95 px-1.5 text-[8px] font-medium shadow-xs ring-1 ring-black/5 transition-colors duration-500",
                          )}
                        >
                          <span
                            className={cn(
                              "size-1 rounded-full transition-colors duration-500",
                              isSold ? "bg-faint" : "bg-success-dot",
                            )}
                          />
                          {isSold ? "Sold" : "Available"}
                        </span>
                      </div>
                      <div className="p-2">
                        <p className="font-mono text-[7px] uppercase tracking-[0.08em] text-faint">{device.brand}</p>
                        <p className={cn("truncate text-[11px] font-semibold leading-4 tracking-tight transition-colors", isSold && "text-muted-foreground")}>
                          {device.model}
                        </p>
                        <p className="truncate text-[9px] leading-3 text-muted-foreground">{deviceSpecLine(device)}</p>
                        <div className="mt-1 flex h-3 items-center">
                          {device.batteryHealth !== null ? (
                            <BatteryBadge health={device.batteryHealth} className="origin-left scale-[0.72]" />
                          ) : (
                            <span className="text-[9px] text-muted-foreground">Excellent</span>
                          )}
                        </div>
                        <p className="tnum mt-1 h-4 text-[11px] font-semibold leading-4 tracking-tight">
                          {isSold ? (
                            <span className="font-normal text-faint">No longer available</span>
                          ) : device.price !== null ? (
                            formatPrice(device.price)
                          ) : null}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
