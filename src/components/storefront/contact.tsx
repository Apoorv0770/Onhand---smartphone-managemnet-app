"use client";

import { Check, Copy, ExternalLink, Phone, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { InstagramIcon, WhatsAppIcon } from "@/components/brand/icons";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatPhone } from "@/lib/format";
import { useCopy } from "@/lib/hooks";
import type { PublicShop, StorefrontEventType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { instagramUrl, whatsappLink } from "@/lib/whatsapp";

type ShopContact = Pick<PublicShop, "name" | "slug" | "whatsappNumber" | "phoneNumber" | "instagramHandle" | "isDemo">;

/** Fire-and-forget storefront analytics. Never blocks or breaks navigation. */
export function trackStorefrontEvent(slug: string, type: StorefrontEventType, deviceId?: string): void {
  try {
    const body = JSON.stringify({ slug, type, deviceId: deviceId ?? null });
    const sent = navigator.sendBeacon?.("/api/public/events", new Blob([body], { type: "application/json" }));
    if (!sent) {
      void fetch("/api/public/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => undefined);
    }
  } catch {
    // Analytics must never get in a customer's way.
  }
}

/* ------------------------------ Demo notices ------------------------------ */

type DemoNotice =
  | { kind: "whatsapp"; message: string }
  | { kind: "call"; number: string }
  | { kind: "instagram"; handle: string };

function DemoNoticeDialog({
  shopName,
  notice,
  onClose,
}: {
  shopName: string;
  notice: DemoNotice | null;
  onClose: () => void;
}) {
  const { copied, copy } = useCopy();
  return (
    <Dialog open={notice !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>This is a demo storefront</DialogTitle>
          <DialogDescription>
            {notice?.kind === "whatsapp"
              ? `${shopName} is a fictional shop, so there is nobody to message. On a real storefront this button opens WhatsApp with the message below, addressed to the shop.`
              : notice?.kind === "call"
                ? `${shopName} is a fictional shop. On a real storefront this button starts a phone call to the shop.`
                : `${shopName} is a fictional shop. On a real storefront this button opens the shop's Instagram profile.`}
          </DialogDescription>
        </DialogHeader>

        {notice?.kind === "whatsapp" ? (
          <>
            <div className="rounded-2xl bg-surface-2 p-3">
              <p className="eyebrow mb-2 text-faint">Prefilled message</p>
              <p className="whitespace-pre-wrap break-words rounded-xl rounded-tl-sm bg-[#dcf7e3] px-3.5 py-2.5 text-sm leading-6 text-[#10301c]">
                {notice.message}
              </p>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => copy(notice.message)}>
                {copied ? <Check /> : <Copy />}
                {copied ? "Copied" : "Copy message"}
              </Button>
              <Button asChild variant="whatsapp">
                <a href={whatsappLink(null, notice.message)} target="_blank" rel="noopener noreferrer">
                  <WhatsAppIcon />
                  Try it in WhatsApp
                  <ExternalLink className="size-3.5 opacity-60" />
                </a>
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="rounded-xl bg-surface-2 px-4 py-3 text-sm">
              <p className="eyebrow mb-1 text-faint">{notice?.kind === "call" ? "Demo number" : "Demo profile"}</p>
              <p className="font-medium">
                {notice?.kind === "call"
                  ? formatPhone(notice.number)
                  : notice?.kind === "instagram"
                    ? `@${notice.handle}`
                    : null}
              </p>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={onClose}>
                Got it
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------- WhatsApp button ---------------------------- */

interface WhatsAppButtonProps extends Omit<ButtonProps, "asChild" | "children" | "variant"> {
  shop: ShopContact;
  /** The exact text to prefill. */
  message: string;
  /** Short public id of the device being asked about, for inquiry analytics. */
  deviceId?: string;
  label?: string;
  variant?: ButtonProps["variant"];
  /** Count this tap in the shop's inquiry analytics. */
  track?: boolean;
}

/**
 * Opens WhatsApp with a ready-to-send message for the shop. On the fictional
 * demo storefronts it explains what would happen instead of messaging anyone.
 */
export function WhatsAppButton({
  shop,
  message,
  deviceId,
  label = "Inquire on WhatsApp",
  variant = "whatsapp",
  size = "md",
  className,
  track = true,
  ...props
}: WhatsAppButtonProps) {
  const [notice, setNotice] = useState<DemoNotice | null>(null);

  return (
    <>
      <Button asChild variant={variant} size={size} className={className} {...props}>
        <a
          href={shop.isDemo ? whatsappLink(null, message) : whatsappLink(shop.whatsappNumber, message)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => {
            if (track) trackStorefrontEvent(shop.slug, "inquiry", deviceId);
            if (shop.isDemo) {
              event.preventDefault();
              setNotice({ kind: "whatsapp", message });
            }
          }}
        >
          <WhatsAppIcon className={size === "lg" ? "size-5" : "size-4"} />
          {label}
        </a>
      </Button>
      {shop.isDemo ? <DemoNoticeDialog shopName={shop.name} notice={notice} onClose={() => setNotice(null)} /> : null}
    </>
  );
}

/* ------------------------------ Share button ------------------------------ */

export function ShareButton({
  title,
  text,
  url,
  label = "Share",
  iconOnly = false,
  className,
  ...props
}: Omit<ButtonProps, "children" | "onClick"> & {
  title: string;
  text?: string;
  /** Absolute URL to share. Defaults to the current page. */
  url?: string;
  label?: string;
  iconOnly?: boolean;
}) {
  const { copy } = useCopy();

  async function share() {
    const target = url ?? window.location.href.split("?")[0];
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url: target });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    const ok = await copy(target);
    if (ok) toast.success("Link copied", { description: "Paste it into a chat or your Instagram bio." });
    else toast.error("Could not copy the link", { description: target });
  }

  return (
    <Button
      variant="secondary"
      aria-label={iconOnly ? label : undefined}
      className={className}
      onClick={share}
      {...props}
    >
      <Share2 />
      {iconOnly ? null : label}
    </Button>
  );
}

/* ----------------------------- Contact actions ---------------------------- */

/** The shop-level contact row: WhatsApp, call and Instagram. */
export function ContactActions({
  shop,
  message,
  className,
}: {
  shop: ShopContact;
  /** General (not device-specific) WhatsApp message. */
  message: string;
  className?: string;
}) {
  const [notice, setNotice] = useState<DemoNotice | null>(null);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <WhatsAppButton
        shop={shop}
        message={message}
        label="WhatsApp"
        size="lg"
        className="h-11 flex-1 rounded-md px-4 text-sm sm:flex-none"
      />
      {shop.phoneNumber ? (
        <Button asChild variant="secondary" className="h-11 px-4">
          <a
            href={`tel:+${shop.phoneNumber}`}
            onClick={(event) => {
              if (shop.isDemo && shop.phoneNumber) {
                event.preventDefault();
                setNotice({ kind: "call", number: shop.phoneNumber });
              }
            }}
          >
            <Phone />
            Call
          </a>
        </Button>
      ) : null}
      {shop.instagramHandle ? (
        <Button asChild variant="secondary" className="h-11 px-3.5 sm:px-4">
          <a
            href={instagramUrl(shop.instagramHandle)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${shop.name} on Instagram`}
            onClick={(event) => {
              if (shop.isDemo && shop.instagramHandle) {
                event.preventDefault();
                setNotice({ kind: "instagram", handle: shop.instagramHandle });
              }
            }}
          >
            <InstagramIcon />
            <span className="hidden sm:inline">Instagram</span>
          </a>
        </Button>
      ) : null}
      {shop.isDemo ? <DemoNoticeDialog shopName={shop.name} notice={notice} onClose={() => setNotice(null)} /> : null}
    </div>
  );
}
