"use client";

import { Check, Copy, Download, ExternalLink, QrCode } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { WhatsAppIcon } from "@/components/brand/icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useCopy, useOrigin } from "@/lib/hooks";
import { siteUrl } from "@/lib/site";
import { cn } from "@/lib/utils";
import { whatsappLink } from "@/lib/whatsapp";

function QrDialog({ url, shopName, open, onOpenChange }: { url: string; shopName: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [code, setCode] = useState<{ url: string; image: string } | null>(null);
  const image = code?.url === url ? code.image : null;

  useEffect(() => {
    if (!open || code?.url === url) return;
    let cancelled = false;
    void import("qrcode")
      .then((module) =>
        module.toDataURL(url, {
          width: 1024,
          margin: 2,
          errorCorrectionLevel: "M",
          color: { dark: "#1f1e1c", light: "#ffffff" },
        }),
      )
      .then((generated) => {
        if (!cancelled) setCode({ url, image: generated });
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not create the QR code");
      });
    return () => {
      cancelled = true;
    };
  }, [open, url, code?.url]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Storefront QR code</DialogTitle>
          <DialogDescription>
            Print it for your counter or shop window. Scanning it opens your catalog.
          </DialogDescription>
        </DialogHeader>
        <div className="mx-auto w-full max-w-64 rounded-2xl border bg-white p-3">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- generated in the browser as a data URL
            <img src={image} alt={`QR code that opens ${url}`} className="aspect-square w-full" />
          ) : (
            <Skeleton className="aspect-square w-full" />
          )}
        </div>
        <p className="break-all text-center font-mono text-xs text-muted-foreground">{url}</p>
        <DialogFooter>
          <Button asChild={Boolean(image)} disabled={!image} className="w-full">
            {image ? (
              <a href={image} download={`${shopName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-qr.png`}>
                <Download />
                Download PNG
              </a>
            ) : (
              <>
                <Download />
                Download PNG
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The storefront link with every way a retailer shares it. */
export function ShareLink({
  slug,
  shopName,
  className,
  size = "md",
}: {
  slug: string;
  shopName: string;
  className?: string;
  size?: "md" | "lg";
}) {
  const origin = useOrigin(siteUrl());
  const url = `${origin}/shop/${slug}`;
  const { copied, copy } = useCopy();
  const [qrOpen, setQrOpen] = useState(false);
  const shareText = `Browse the phones we have in stock at ${shopName}:\n${url}`;

  async function copyLink() {
    const ok = await copy(url);
    if (ok) toast.success("Link copied", { description: "Paste it into your Instagram bio or a WhatsApp status." });
    else toast.error("Could not copy the link", { description: url });
  }

  return (
    <div className={cn("grid min-w-0 grid-cols-1 gap-3", className)}>
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border bg-surface-2 pl-3.5 pr-1.5",
          size === "lg" ? "h-14" : "h-12",
        )}
      >
        <p
          title={url}
          className={cn("flex min-w-0 flex-1 overflow-hidden font-mono", size === "lg" ? "text-sm" : "text-[13px]")}
        >
          {/* The host gives way first, so the part customers recognise stays visible. */}
          <span className="min-w-0 shrink-[100] truncate text-faint">{origin.replace(/^https?:\/\//, "")}</span>
          <span className="min-w-0 truncate font-medium text-foreground">/shop/{slug}</span>
        </p>
        <Button
          variant={copied ? "subtle" : "primary"}
          size="sm"
          className={cn("shrink-0", size === "lg" && "h-10 px-4 text-sm")}
          onClick={copyLink}
        >
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Button asChild variant="secondary" size="sm" className="h-9">
          <a href={`/shop/${slug}?preview=1`} target="_blank" rel="noopener noreferrer">
            <ExternalLink />
            Open
          </a>
        </Button>
        <Button asChild variant="secondary" size="sm" className="h-9">
          <a href={whatsappLink(null, shareText)} target="_blank" rel="noopener noreferrer">
            <WhatsAppIcon />
            Share
          </a>
        </Button>
        <Button variant="secondary" size="sm" className="h-9" onClick={() => setQrOpen(true)}>
          <QrCode />
          QR code
        </Button>
      </div>
      <QrDialog url={url} shopName={shopName} open={qrOpen} onOpenChange={setQrOpen} />
    </div>
  );
}
