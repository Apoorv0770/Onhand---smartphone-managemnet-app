import { Compass } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
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
            <Compass className="size-6" />
          </div>
          <p className="eyebrow mt-6 text-brand-strong">Error 404</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">We could not find that page</h1>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-6 text-muted-foreground">
            The link may be out of date or mistyped. Head back to the start, or open a demo storefront to see how a
            catalog looks.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-2 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/">Back to {site.name}</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href={`/shop/${site.demoShopSlug}`}>Open the demo storefront</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
