"use client";

import { ArrowLeft, Check, ChevronLeft, ChevronRight, Info, MapPin, Phone, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { BatteryBadge, StatusBadge } from "@/components/device/badges";
import { DeviceVisual } from "@/components/device/device-visual";
import { ShopAvatar } from "@/components/shop/shop-avatar";
import { Button } from "@/components/ui/button";
import { colourToHex, CONDITION_DESCRIPTION, CONDITION_LABEL } from "@/lib/catalog";
import { batteryTone, devicePath, deviceSpecLine, deviceTitle } from "@/lib/device";
import { formatDate, formatPrice, formatStorage } from "@/lib/format";
import { useEmbeddedPreview, useOrigin } from "@/lib/hooks";
import { siteUrl } from "@/lib/site";
import type { PublicDevice, PublicShop } from "@/lib/types";
import { cn } from "@/lib/utils";
import { buildGeneralMessage, buildInquiryMessage } from "@/lib/whatsapp";
import { ShareButton, WhatsAppButton } from "./contact";
import { DeviceCard } from "./device-card";
import { OpenStatus } from "./open-status";
import { DemoRibbon } from "./shop-header";
import { StorefrontFooter } from "./storefront-footer";

/* --------------------------------- Gallery -------------------------------- */

function Gallery({ device }: { device: PublicDevice }) {
  const title = deviceTitle(device);
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const images = device.images;
  const sold = device.availability === "sold";

  function goTo(index: number) {
    const element = track.current;
    if (!element) return;
    const clamped = Math.max(0, Math.min(images.length - 1, index));
    element.scrollTo({ left: clamped * element.clientWidth, behavior: "smooth" });
  }

  if (images.length === 0) {
    return (
      <figure>
        <DeviceVisual
          brand={device.brand}
          model={device.model}
          colour={device.colour}
          alt={`Illustration of a ${title} in ${device.colour}`}
          loading="eager"
          inset="p-[9%]"
          className={cn(
            "aspect-[4/4.2] rounded-3xl border sm:aspect-[4/3.4] lg:aspect-square",
            sold && "opacity-70 saturate-[0.2]",
          )}
        />
        <figcaption className="mt-2.5 flex items-start gap-1.5 text-xs leading-5 text-faint">
          <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          Illustration in the listed colour. The shop has not added photos of this phone yet.
        </figcaption>
      </figure>
    );
  }

  return (
    <div>
      <div className="group relative">
        <div
          ref={track}
          onScroll={(event) => {
            const element = event.currentTarget;
            const index = Math.round(element.scrollLeft / Math.max(1, element.clientWidth));
            if (index !== active) setActive(index);
          }}
          className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto scroll-smooth rounded-3xl border bg-surface-2"
          aria-roledescription="carousel"
          aria-label={`Photos of ${title}`}
        >
          {images.map((image, index) => (
            <div
              key={image.url}
              role="group"
              aria-roledescription="slide"
              aria-label={`Photo ${index + 1} of ${images.length}`}
              className="w-full shrink-0 snap-center"
            >
              <DeviceVisual
                brand={device.brand}
                model={device.model}
                colour={device.colour}
                imageUrl={image.url}
                alt={`${title}, photo ${index + 1}`}
                loading={index === 0 ? "eager" : "lazy"}
                className={cn("aspect-[4/4.2] sm:aspect-[4/3.4] lg:aspect-square", sold && "opacity-70 saturate-[0.2]")}
              />
            </div>
          ))}
        </div>
        {images.length > 1 ? (
          <>
            <span className="tnum absolute bottom-3 right-3 rounded-full bg-foreground/70 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
              {active + 1} / {images.length}
            </span>
            <Button
              variant="secondary"
              size="icon"
              aria-label="Previous photo"
              disabled={active === 0}
              onClick={() => goTo(active - 1)}
              className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-full opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-0 md:flex"
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              aria-label="Next photo"
              disabled={active === images.length - 1}
              onClick={() => goTo(active + 1)}
              className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-0 md:flex"
            >
              <ChevronRight />
            </Button>
          </>
        ) : null}
      </div>

      {images.length > 1 ? (
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((image, index) => (
            <button
              key={image.url}
              type="button"
              aria-label={`Show photo ${index + 1}`}
              aria-current={index === active}
              onClick={() => goTo(index)}
              className={cn(
                "relative size-16 shrink-0 overflow-hidden rounded-xl border-2 transition-[border-color,opacity]",
                index === active ? "border-foreground" : "border-transparent opacity-70 hover:opacity-100",
              )}
            >
              <DeviceVisual
                brand={device.brand}
                model={device.model}
                colour={device.colour}
                imageUrl={image.url}
                alt=""
                className="size-full"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ---------------------------------- Facts --------------------------------- */

function Fact({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border bg-surface p-4", className)}>
      <dt className="eyebrow text-faint">{label}</dt>
      <dd className="mt-1.5">{children}</dd>
    </div>
  );
}

const METER_TONE = { good: "bg-success-dot", ok: "bg-warning-dot", low: "bg-danger" } as const;

/* ---------------------------------- Page ---------------------------------- */

export function DeviceDetail({
  shop,
  device,
  related,
  serverNow,
}: {
  shop: PublicShop;
  device: PublicDevice;
  related: PublicDevice[];
  serverNow: number;
}) {
  useEmbeddedPreview();
  const origin = useOrigin(siteUrl());
  const title = deviceTitle(device);
  const pageUrl = `${origin}${devicePath(shop.slug, device)}`;
  const shopHref = `/shop/${shop.slug}`;
  const sold = device.availability === "sold";
  const reserved = device.availability === "reserved";

  const inquiry = sold
    ? buildGeneralMessage(shop.name, `${origin}${shopHref}`)
    : buildInquiryMessage(device, pageUrl);
  const ctaLabel = sold ? "Ask about similar phones" : "Inquire on WhatsApp";

  return (
    <div className="flex min-h-dvh flex-col">
      {shop.isDemo ? <DemoRibbon /> : null}

      <div className="sticky top-0 z-30 border-b border-transparent bg-background/90 backdrop-blur-md">
        <div className="container-page flex h-14 items-center justify-between gap-3">
          <Link
            href={shopHref}
            className="group -ml-2 inline-flex min-w-0 items-center gap-2.5 rounded-full py-1 pl-2 pr-3.5 text-sm font-medium transition-colors hover:bg-surface-3"
          >
            <ArrowLeft aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5" />
            <ShopAvatar name={shop.name} logoUrl={shop.logoUrl} className="size-7 rounded-lg" textClassName="text-2xs" />
            <span className="truncate">{shop.name}</span>
          </Link>
          <ShareButton
            title={`${title} at ${shop.name}`}
            text={`${title}, ${deviceSpecLine(device)}`}
            url={pageUrl}
            iconOnly
            label="Share this phone"
            variant="ghost"
            size="icon"
            className="-mr-2 rounded-full"
          />
        </div>
      </div>

      <main className="container-page flex-1 pb-32 pt-3 sm:pt-6 lg:pb-20">
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14">
          <div className="lg:sticky lg:top-20 lg:self-start">
            <Gallery device={device} />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={device.availability} />
              <span className="inline-flex h-6 items-center rounded-full border bg-surface px-2.5 font-mono text-xs text-muted-foreground">
                Ref {device.reference}
              </span>
            </div>

            <p className="eyebrow mt-5 text-faint">{device.brand}</p>
            <h1 className="mt-1.5 text-[32px] font-semibold leading-[1.08] tracking-[-0.035em] sm:text-[44px]">
              {device.model}
            </h1>
            <p className="mt-2.5 flex items-center gap-2 text-base text-muted-foreground sm:text-lg">
              <span
                aria-hidden
                className="size-3.5 shrink-0 rounded-full ring-1 ring-black/15"
                style={{ backgroundColor: colourToHex(device.colour, device.brand) }}
              />
              {deviceSpecLine(device)}
            </p>

            <div className="mt-6">
              {device.price !== null ? (
                <p className="tnum text-[32px] font-semibold leading-none tracking-[-0.03em]">
                  {formatPrice(device.price)}
                </p>
              ) : sold ? (
                <p className="text-lg font-medium text-muted-foreground">This phone has been sold</p>
              ) : (
                <>
                  <p className="text-xl font-semibold tracking-[-0.02em]">Price on request</p>
                  <p className="mt-1 text-sm text-muted-foreground">Message the shop and they will share the price.</p>
                </>
              )}
            </div>

            {sold || reserved ? (
              <div className="mt-5 flex items-start gap-3 rounded-2xl border bg-surface-2 p-4 text-sm leading-6">
                <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <p>
                  {sold
                    ? "This phone is no longer available. The shop may have similar phones in stock."
                    : "This phone is reserved for another customer. Ask the shop if it becomes available again."}{" "}
                  <Link href={shopHref} className="font-medium text-brand-strong underline-offset-4 hover:underline">
                    See what is available
                  </Link>
                </p>
              </div>
            ) : null}

            <div className="mt-6 hidden gap-2 lg:flex">
              <WhatsAppButton
                shop={shop}
                message={inquiry}
                deviceId={device.id}
                label={ctaLabel}
                size="lg"
                className="flex-1"
              />
              {shop.phoneNumber && !shop.isDemo ? (
                <Button asChild variant="secondary" size="lg">
                  <a href={`tel:+${shop.phoneNumber}`}>
                    <Phone />
                    Call
                  </a>
                </Button>
              ) : null}
            </div>

            <dl className="mt-8 grid grid-cols-2 gap-3">
              {device.batteryHealth !== null ? (
                <Fact label="Battery health">
                  <div className="flex items-center justify-between gap-2">
                    <span className="tnum text-xl font-semibold tracking-[-0.02em]">{device.batteryHealth}%</span>
                    <BatteryBadge health={device.batteryHealth} className="[&>span]:hidden text-[0px]" />
                  </div>
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
                    <div
                      className={cn("h-full rounded-full", METER_TONE[batteryTone(device.batteryHealth)])}
                      style={{ width: `${device.batteryHealth}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs leading-4 text-faint">As reported by the phone</p>
                </Fact>
              ) : null}
              <Fact label="Condition" className={device.batteryHealth === null ? "col-span-2" : undefined}>
                <span className="text-xl font-semibold tracking-[-0.02em]">{CONDITION_LABEL[device.condition]}</span>
                <p className="mt-1.5 text-[13px] leading-5 text-muted-foreground">
                  {CONDITION_DESCRIPTION[device.condition]}
                </p>
              </Fact>
              <Fact label="Storage">
                <span className="tnum text-xl font-semibold tracking-[-0.02em]">{formatStorage(device.storageGb)}</span>
              </Fact>
              <Fact label="Colour">
                <span className="flex items-start gap-2 text-lg font-semibold leading-6 tracking-[-0.02em]">
                  <span
                    aria-hidden
                    className="mt-1 size-4 shrink-0 rounded-full ring-1 ring-black/15"
                    style={{ backgroundColor: colourToHex(device.colour, device.brand) }}
                  />
                  <span className="min-w-0 break-words">{device.colour}</span>
                </span>
              </Fact>
            </dl>

            {device.cosmeticCondition || device.functionalCondition ? (
              <section className="mt-8">
                <h2 className="text-base font-semibold tracking-[-0.01em]">Condition details</h2>
                <dl className="mt-3 divide-y rounded-2xl border bg-surface">
                  {device.cosmeticCondition ? (
                    <div className="grid gap-1 p-4 sm:grid-cols-[8rem_1fr] sm:gap-4">
                      <dt className="text-[13px] font-medium text-muted-foreground">Cosmetic</dt>
                      <dd className="text-sm leading-6">{device.cosmeticCondition}</dd>
                    </div>
                  ) : null}
                  {device.functionalCondition ? (
                    <div className="grid gap-1 p-4 sm:grid-cols-[8rem_1fr] sm:gap-4">
                      <dt className="text-[13px] font-medium text-muted-foreground">Functional</dt>
                      <dd className="text-sm leading-6">{device.functionalCondition}</dd>
                    </div>
                  ) : null}
                </dl>
              </section>
            ) : null}

            {device.accessories.length > 0 || device.warranty ? (
              <section className="mt-8 grid gap-3 sm:grid-cols-2">
                {device.accessories.length > 0 ? (
                  <div className="rounded-2xl border bg-surface p-4">
                    <h2 className="eyebrow text-faint">Included</h2>
                    <ul className="mt-2.5 grid gap-2">
                      {device.accessories.map((item) => (
                        <li key={item} className="flex items-center gap-2 text-sm">
                          <Check aria-hidden className="size-4 shrink-0 text-success" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {device.warranty ? (
                  <div className="rounded-2xl border bg-surface p-4">
                    <h2 className="eyebrow text-faint">Warranty</h2>
                    <p className="mt-2.5 flex items-start gap-2 text-sm leading-6">
                      <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      {device.warranty}
                    </p>
                  </div>
                ) : null}
              </section>
            ) : null}

            <Link
              href={shopHref}
              className="group mt-8 flex items-center gap-3 rounded-2xl border bg-surface p-4 outline-offset-4 transition-colors hover:border-border-strong"
            >
              <ShopAvatar name={shop.name} logoUrl={shop.logoUrl} className="size-11 rounded-xl" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{shop.name}</span>
                {shop.location ? (
                  <span className="mt-0.5 flex items-start gap-1 text-[13px] leading-5 text-muted-foreground">
                    <MapPin aria-hidden className="mt-[3px] size-3.5 shrink-0" />
                    {shop.location}
                  </span>
                ) : null}
                <OpenStatus hours={shop.hours} serverNow={serverNow} className="mt-0.5 text-[13px] text-muted-foreground" />
              </span>
              <span className="flex shrink-0 items-center gap-1 text-[13px] font-medium text-brand-strong">
                <span className="hidden sm:inline">All phones</span>
                <ChevronRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>

            <p className="mt-4 text-xs text-faint">Listed on {formatDate(device.addedAt)}</p>
          </div>
        </div>

        {related.length > 0 ? (
          <section className="mt-14 sm:mt-20">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-xl font-semibold tracking-[-0.025em] sm:text-2xl">More from this shop</h2>
              <Link href={shopHref} className="shrink-0 text-sm font-medium text-brand-strong underline-offset-4 hover:underline">
                View all
              </Link>
            </div>
            <ul className="no-scrollbar -mx-4 mt-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-4">
              {related.map((item) => (
                <li key={item.id} className="flex w-[44%] shrink-0 snap-start sm:w-auto">
                  <DeviceCard device={item} shopSlug={shop.slug} className="w-full" />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>

      <StorefrontFooter shop={shop} />

      {/* Thumb-reach inquiry bar on phones */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/92 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-2">
          {shop.phoneNumber && !shop.isDemo ? (
            <Button asChild variant="secondary" size="icon-lg" aria-label={`Call ${shop.name}`}>
              <a href={`tel:+${shop.phoneNumber}`}>
                <Phone />
              </a>
            </Button>
          ) : null}
          <WhatsAppButton
            shop={shop}
            message={inquiry}
            deviceId={device.id}
            label={ctaLabel}
            size="lg"
            className="flex-1"
          />
        </div>
      </div>
    </div>
  );
}
