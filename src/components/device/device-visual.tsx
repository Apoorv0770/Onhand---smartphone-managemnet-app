"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { DeviceRender, tileTint } from "./device-render";

interface DeviceVisualProps {
  brand: string;
  model: string;
  colour: string;
  /** A retailer photo. Falls back to the illustration when missing or broken. */
  imageUrl?: string | null;
  alt: string;
  className?: string;
  /** Padding around the illustration, as a Tailwind class. */
  inset?: string;
  loading?: "lazy" | "eager";
}

/**
 * The picture slot for a device: the retailer's photo when there is one,
 * otherwise a drawn illustration on a softly tinted tile. A failed image
 * load switches to the illustration, so a broken image never shows.
 */
export function DeviceVisual({
  brand,
  model,
  colour,
  imageUrl,
  alt,
  className,
  inset = "p-[10%]",
  loading = "lazy",
}: DeviceVisualProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showPhoto = Boolean(imageUrl) && failedUrl !== imageUrl;
  const tint = tileTint(colour, brand);

  return (
    <div
      data-slot="device-visual"
      className={cn("relative isolate overflow-hidden bg-surface-2", className)}
      style={
        showPhoto
          ? undefined
          : { backgroundImage: `radial-gradient(125% 90% at 50% 0%, ${tint.from} 0%, ${tint.to} 100%)` }
      }
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- uploads are pre-sized on the client and served by our own route
        <img
          key={imageUrl}
          src={imageUrl ?? undefined}
          alt={alt}
          loading={loading}
          decoding="async"
          onError={() => setFailedUrl(imageUrl ?? null)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <div className={cn("absolute inset-0 flex items-center justify-center", inset)}>
          <DeviceRender brand={brand} model={model} colour={colour} label={alt} className="max-h-full max-w-full" />
        </div>
      )}
    </div>
  );
}
