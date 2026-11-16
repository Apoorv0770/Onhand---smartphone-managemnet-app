import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StorefrontSkeleton } from "@/components/storefront/skeletons";
import { Storefront } from "@/components/storefront/storefront";
import { plural } from "@/lib/format";
import { site, siteUrl } from "@/lib/site";
import { requestNow } from "@/server/clock";
import { jsonLd, loadPublicDevices, loadPublicShop } from "@/server/public-data";

type Props = PageProps<"/shop/[shopSlug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { shopSlug } = await params;
  const shop = await loadPublicShop(shopSlug);
  if (!shop) {
    return { title: "Storefront not found", robots: { index: false, follow: false } };
  }
  const devices = await loadPublicDevices(shopSlug);
  const available = devices.filter((device) => device.availability === "available").length;
  const title = `${shop.name} · Phones in stock`;
  const description =
    shop.description ||
    `Browse the second-hand phones in stock at ${shop.name}${shop.location ? `, ${shop.location}` : ""}.`;
  const summary = `${plural(available, "phone")} available now. ${description}`;

  return {
    title: { absolute: title },
    description: summary,
    alternates: { canonical: `/shop/${shop.slug}` },
    robots: shop.isDemo ? { index: false, follow: true } : undefined,
    openGraph: {
      type: "website",
      title,
      description: summary,
      url: `/shop/${shop.slug}`,
      siteName: site.name,
    },
    twitter: { card: "summary", title, description: summary },
  };
}

export default function ShopPage({ params }: Props) {
  return (
    <Suspense fallback={<StorefrontSkeleton />}>
      <ShopContent params={params} />
    </Suspense>
  );
}

async function ShopContent({ params }: Pick<Props, "params">) {
  const { shopSlug } = await params;
  const [shop, devices] = await Promise.all([loadPublicShop(shopSlug), loadPublicDevices(shopSlug)]);
  if (!shop) notFound();
  const serverNow = await requestNow();

  const structured = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: shop.name,
    description: shop.description || undefined,
    url: `${siteUrl()}/shop/${shop.slug}`,
    address: shop.location || undefined,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structured) }} />
      <Storefront shop={shop} initialDevices={devices} serverNow={serverNow} />
    </>
  );
}
