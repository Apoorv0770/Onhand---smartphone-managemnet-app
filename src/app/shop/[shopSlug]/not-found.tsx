import { Store } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Storefront not found",
  robots: { index: false, follow: false },
};

export default function ShopNotFound() {
  return (
    // The dotted backdrop is wider than a phone screen, so clip it sideways.
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <header className="container-page flex h-16 items-center">
        <Link href="/" aria-label={`${site.name} home`} className="rounded-md">
          <Logo />
        </Link>
      </header>
      <main className="container-page flex flex-1 items-center justify-center pb-24 pt-8">
        <div className="relative isolate w-full max-w-lg text-center">
          <div aria-hidden className="bg-dots mask-fade-edges absolute -inset-x-10 -inset-y-16 -z-10" />
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border bg-surface text-muted-foreground shadow-sm">
            <Store className="size-6" />
          </div>
          <p className="eyebrow mt-6 text-brand-strong">Error 404</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">This storefront does not exist</h1>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-6 text-muted-foreground">
            The link may have a typing mistake, or the shop may have changed its address. Ask the shop for its current
            link, or have a look at a demo storefront instead.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-2 sm:flex-row">
            <Button asChild size="lg">
              <Link href={`/shop/${site.demoShopSlug}`}>Open the demo storefront</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/">Go to {site.name}</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
