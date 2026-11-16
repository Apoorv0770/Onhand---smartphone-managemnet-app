"use client";

import { ExternalLink, FlaskConical } from "lucide-react";
import Link from "next/link";
import { ShopAvatar } from "@/components/shop/shop-avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface BusinessBrief {
  name: string;
  slug: string;
  logoUrl: string | null;
}

/** Business block at the top of the sidebar. */
export function BusinessBadge({ name, slug, logoUrl }: BusinessBrief) {
  return (
    <Link
      href="/dashboard/storefront"
      title={name}
      className="flex items-center gap-2.5 rounded-lg border bg-surface p-2 shadow-xs outline-offset-0 transition-colors hover:border-border-strong in-data-[sidebar=collapsed]:lg:justify-center in-data-[sidebar=collapsed]:lg:border-transparent in-data-[sidebar=collapsed]:lg:bg-transparent in-data-[sidebar=collapsed]:lg:p-0 in-data-[sidebar=collapsed]:lg:shadow-none"
    >
      <ShopAvatar name={name} logoUrl={logoUrl} className="size-9 rounded-lg" textClassName="text-xs" />
      <span className="min-w-0 flex-1 in-data-[sidebar=collapsed]:lg:hidden">
        <span className="block truncate text-[13px] font-semibold leading-4">{name}</span>
        <span className="mt-0.5 block truncate font-mono text-2xs leading-4 text-muted-foreground">/shop/{slug}</span>
      </span>
    </Link>
  );
}

/** Compact identity in the phone top bar. */
export function MobileBusinessBadge({ name, logoUrl }: BusinessBrief) {
  return (
    <Link href="/dashboard" className="-ml-1 inline-flex max-w-full items-center gap-2.5 rounded-lg p-1">
      <ShopAvatar name={name} logoUrl={logoUrl} className="size-8 rounded-lg" textClassName="text-2xs" />
      <span className="truncate text-sm font-semibold">{name}</span>
    </Link>
  );
}

/** Opens the public storefront in a new tab, flagged so it is not counted as a customer visit. */
export function StorefrontShortcut({ slug }: { slug: string }) {
  return (
    <Button asChild variant="secondary" size="sm">
      <a href={`/shop/${slug}?preview=1`} target="_blank" rel="noopener noreferrer">
        <span className="hidden sm:inline">View storefront</span>
        <span className="sm:hidden">Storefront</span>
        <ExternalLink className="size-3.5 text-muted-foreground" />
      </a>
    </Button>
  );
}

/** States plainly that the app is running on local demo data. */
export function DemoModeBadge() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1.5 rounded-full border border-brand/25 bg-brand-soft px-2 text-xs font-medium text-brand-strong transition-colors hover:border-brand/45 sm:px-2.5"
        >
          <FlaskConical aria-hidden className="size-3.5" />
          <span className="max-sm:sr-only">Demo mode</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 text-sm leading-6">
        <p className="font-semibold">Running on local demo data</p>
        <p className="mt-1.5 text-muted-foreground">
          No Supabase project is connected, so accounts, inventory and photos are saved in the{" "}
          <code className="rounded bg-surface-3 px-1 py-0.5 font-mono text-xs text-foreground">.data</code> folder on
          this machine. Everything works and survives restarts, but it is not a hosted database.
        </p>
        <p className="mt-2 text-muted-foreground">
          Add your Supabase keys to <code className="rounded bg-surface-3 px-1 py-0.5 font-mono text-xs text-foreground">.env.local</code>{" "}
          to switch to Postgres, Supabase Auth and Storage. The README has the steps.
        </p>
      </PopoverContent>
    </Popover>
  );
}
