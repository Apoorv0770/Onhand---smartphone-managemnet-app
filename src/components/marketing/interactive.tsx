"use client";

import { Check, Eye, EyeOff, MapPin } from "lucide-react";
import { useState } from "react";
import { ShopAvatar } from "@/components/shop/shop-avatar";
import { ShopCover } from "@/components/storefront/shop-header";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Switch } from "@/components/ui/controls";
import { COVER_STYLES } from "@/lib/catalog";
import type { CoverStyleId } from "@/lib/types";
import { cn } from "@/lib/utils";

/* ----------------------------- Cover switcher ----------------------------- */

/** Lets a visitor try the storefront cover styles a retailer can choose from. */
export function CoverSwitcher() {
  const [cover, setCover] = useState<CoverStyleId>("ember");

  return (
    <div>
      <ShopCover
        shop={{ bannerUrl: null, coverStyle: cover }}
        className="rounded-[28px] px-5 pb-5 pt-16 shadow-md transition-[background] duration-500 sm:px-7 sm:pb-7 sm:pt-24"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
          <ShopAvatar
            name="Your Shop Name"
            className="size-14 rounded-2xl shadow-lg ring-1 ring-white/25 sm:size-[72px]"
            textClassName="text-lg sm:text-xl"
          />
          <div className="min-w-0 pb-0.5">
            <p className="text-2xl font-semibold leading-tight tracking-[-0.035em] sm:text-[34px]">Your Shop Name</p>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] sm:text-sm">
              <span className="inline-flex items-center gap-1.5 opacity-85">
                <MapPin aria-hidden className="size-3.5" />
                Your area, your city
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-1.5 rounded-full bg-success-dot" />
                <span className="font-medium">Open now</span>
                <span className="opacity-75">· Closes 9:00 PM</span>
              </span>
            </p>
          </div>
        </div>
      </ShopCover>

      <div role="radiogroup" aria-label="Cover style" className="mt-4 flex flex-wrap gap-2">
        {COVER_STYLES.map((style) => {
          const selected = style.id === cover;
          return (
            <button
              key={style.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setCover(style.id)}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-full border bg-surface pl-1.5 pr-3.5 text-sm font-medium transition-[border-color,box-shadow]",
                selected ? "border-foreground shadow-sm" : "hover:border-border-strong",
              )}
            >
              <span
                className="flex size-7 items-center justify-center rounded-full ring-1 ring-black/10"
                style={{ background: style.background }}
              >
                {selected ? <Check aria-hidden className={cn("size-3.5", style.tone === "dark" ? "text-white" : "text-foreground")} strokeWidth={3} /> : null}
              </span>
              {style.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------- Price visibility ---------------------------- */

/** A working miniature of the per-device price switch. */
export function PriceToggleDemo() {
  const [shown, setShown] = useState(true);
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3 rounded-xl border bg-surface px-3.5 py-3 shadow-xs">
        <label htmlFor="demo-price" className="flex cursor-pointer items-center gap-2 text-[13px] font-medium">
          {shown ? <Eye aria-hidden className="size-4 text-muted-foreground" /> : <EyeOff aria-hidden className="size-4 text-muted-foreground" />}
          Show price on storefront
        </label>
        <Switch id="demo-price" checked={shown} onCheckedChange={setShown} />
      </div>
      <div className="rounded-xl border bg-surface px-3.5 py-3 shadow-xs">
        <p className="eyebrow text-faint">Customers see</p>
        <p aria-live="polite" className="mt-1 h-7 text-lg font-semibold tracking-[-0.02em]">
          {shown ? "₹64,000" : <span className="text-[15px] font-normal text-muted-foreground">Price on request</span>}
        </p>
      </div>
    </div>
  );
}

/* ----------------------------------- FAQ ---------------------------------- */

export function Faq({ items }: { items: { question: string; answer: string }[] }) {
  return (
    <Accordion type="single" collapsible className="border-t">
      {items.map((item, index) => (
        <AccordionItem key={item.question} value={`item-${index}`}>
          <AccordionTrigger>{item.question}</AccordionTrigger>
          <AccordionContent>{item.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
