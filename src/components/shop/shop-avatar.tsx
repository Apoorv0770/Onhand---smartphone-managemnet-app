"use client";

import { useState } from "react";
import { cn, hashString, initials } from "@/lib/utils";

const TONES = [
  "bg-[#1f1e1c] text-[#f6f3ec]",
  "bg-[#7a2f16] text-[#fdeee4]",
  "bg-[#17454b] text-[#e3f4f1]",
  "bg-[#2f4329] text-[#eaf3e2]",
  "bg-[#27304d] text-[#e6eaf8]",
  "bg-[#5c3a1e] text-[#f9ecd9]",
];

/** A shop's logo, or a calm monogram when it has not uploaded one. */
export function ShopAvatar({
  name,
  logoUrl,
  className,
  textClassName,
}: {
  name: string;
  logoUrl?: string | null;
  className?: string;
  textClassName?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showLogo = Boolean(logoUrl) && failedUrl !== logoUrl;
  const tone = TONES[hashString(name) % TONES.length];

  return (
    <span
      data-slot="shop-avatar"
      className={cn(
        "relative inline-flex size-10 shrink-0 select-none items-center justify-center overflow-hidden rounded-xl font-semibold tracking-[-0.02em]",
        !showLogo && tone,
        className,
      )}
    >
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element -- small, pre-sized upload
        <img
          src={logoUrl ?? undefined}
          alt=""
          decoding="async"
          onError={() => setFailedUrl(logoUrl ?? null)}
          className="size-full object-cover"
        />
      ) : (
        <span aria-hidden className={cn("text-sm", textClassName)}>
          {initials(name)}
        </span>
      )}
    </span>
  );
}
