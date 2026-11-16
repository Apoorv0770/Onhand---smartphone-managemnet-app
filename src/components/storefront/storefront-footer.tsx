import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { site } from "@/lib/site";
import type { PublicShop } from "@/lib/types";

/** Quiet footer: whose catalog this is, and what powers it. */
export function StorefrontFooter({ shop }: { shop: Pick<PublicShop, "name" | "location"> }) {
  return (
    <footer className="border-t">
      <div className="container-page flex flex-col gap-4 py-7 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p className="leading-5">
          <span className="font-medium text-foreground">{shop.name}</span>
          {shop.location ? ` · ${shop.location}` : ""}
          <br className="sm:hidden" />
          <span className="sm:ml-2">Availability is updated by the shop. Confirm before you travel.</span>
        </p>
        <Link
          href="/"
          className="group inline-flex shrink-0 items-center gap-2 rounded-full border bg-surface px-3 py-1.5 font-medium text-foreground shadow-xs transition-colors hover:border-border-strong"
        >
          <LogoMark className="size-4" />
          Catalog by {site.name}
          <ArrowUpRight
            aria-hidden
            className="size-3.5 text-faint transition-transform group-hover:-translate-y-px group-hover:translate-x-px"
          />
        </Link>
      </div>
    </footer>
  );
}
