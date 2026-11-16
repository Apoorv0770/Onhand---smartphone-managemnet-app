"use client";

import { MapPin } from "lucide-react";
import { ShopAvatar } from "@/components/shop/shop-avatar";
import { coverStyle } from "@/lib/catalog";
import { useOrigin } from "@/lib/hooks";
import { siteUrl } from "@/lib/site";
import type { PublicShop } from "@/lib/types";
import { cn } from "@/lib/utils";
import { buildGeneralMessage } from "@/lib/whatsapp";
import { ContactActions, ShareButton } from "./contact";
import { OpenStatus } from "./open-status";

/** Slim notice shown on the seeded, fictional storefronts. */
export function DemoRibbon() {
  return (
    <div className="border-b border-brand/15 bg-brand-soft text-brand-strong">
      <p className="container-page py-2 text-center text-[13px] leading-5">
        <span className="font-semibold">Demo storefront.</span> The shop and its inventory are fictional.
      </p>
    </div>
  );
}

/** Cover artwork for a shop: its banner photo or one of the built-in styles. */
export function ShopCover({
  shop,
  className,
  children,
}: {
  shop: Pick<PublicShop, "bannerUrl" | "coverStyle">;
  className?: string;
  children?: React.ReactNode;
}) {
  const cover = coverStyle(shop.coverStyle);
  const onDark = Boolean(shop.bannerUrl) || cover.tone === "dark";
  return (
    <div
      data-tone={onDark ? "dark" : "light"}
      className={cn("relative isolate overflow-hidden", onDark ? "text-white" : "text-foreground", className)}
      style={{ background: cover.background }}
    >
      {shop.bannerUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized upload served by our own route */}
          <img src={shop.bannerUrl} alt="" className="absolute inset-0 -z-10 size-full object-cover" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/35 to-black/15" />
        </>
      ) : (
        <>
          <div
            aria-hidden
            className={cn(
              "absolute inset-0 -z-10 [background-size:22px_22px] [mask-image:radial-gradient(90%_120%_at_100%_0%,black,transparent_70%)]",
              onDark
                ? "bg-[radial-gradient(rgb(255_255_255/0.16)_1px,transparent_1px)]"
                : "bg-[radial-gradient(rgb(0_0_0/0.14)_1px,transparent_1px)]",
            )}
          />
          <div
            aria-hidden
            className={cn(
              "absolute -right-16 -top-24 -z-10 size-72 rounded-full border-[28px] sm:size-96 sm:border-[40px]",
              onDark ? "border-white/[0.045]" : "border-black/[0.04]",
            )}
          />
        </>
      )}
      {children}
    </div>
  );
}

export function ShopHeader({ shop, serverNow }: { shop: PublicShop; serverNow: number }) {
  const origin = useOrigin(siteUrl());
  const shopUrl = `${origin}/shop/${shop.slug}`;

  return (
    <header className="container-page pt-3 sm:pt-5">
      <ShopCover shop={shop} className="rounded-[26px] px-5 pb-5 pt-14 sm:rounded-[32px] sm:px-8 sm:pb-8 sm:pt-28">
        <ShareButton
          title={shop.name}
          text={`Phones in stock at ${shop.name}`}
          url={shopUrl}
          iconOnly
          label="Share this storefront"
          size="icon"
          className="absolute right-3 top-3 border-white/20 bg-white/15 text-current shadow-none backdrop-blur-md hover:border-white/30 hover:bg-white/25 in-data-[tone=light]:border-black/10 in-data-[tone=light]:bg-black/5 in-data-[tone=light]:hover:bg-black/10 sm:right-4 sm:top-4"
        />
        <div className="flex flex-col gap-3.5 sm:flex-row sm:items-end sm:gap-4">
          <ShopAvatar
            name={shop.name}
            logoUrl={shop.logoUrl}
            className="size-14 rounded-2xl shadow-lg ring-1 ring-white/25 sm:size-20 sm:rounded-[22px]"
            textClassName="text-lg sm:text-2xl"
          />
          <div className="min-w-0 pb-0.5">
            <h1 className="text-[26px] font-semibold leading-[1.1] tracking-[-0.035em] sm:text-[40px]">{shop.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[13px] leading-5 sm:text-sm">
              {shop.location ? (
                <span className="inline-flex items-center gap-1.5 opacity-85">
                  <MapPin aria-hidden className="size-3.5 shrink-0" />
                  {shop.location}
                </span>
              ) : null}
              <OpenStatus hours={shop.hours} serverNow={serverNow} />
            </div>
          </div>
        </div>
      </ShopCover>

      <div className="mt-4 flex flex-col gap-4 sm:mt-5 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
        {shop.description ? (
          <p className="max-w-2xl text-[15px] leading-6 text-muted-foreground">{shop.description}</p>
        ) : (
          <span />
        )}
        <ContactActions shop={shop} message={buildGeneralMessage(shop.name, shopUrl)} className="shrink-0" />
      </div>
    </header>
  );
}
