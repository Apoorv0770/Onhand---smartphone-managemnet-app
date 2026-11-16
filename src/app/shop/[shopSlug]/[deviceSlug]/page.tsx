import { PackageX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DeviceCard } from "@/components/storefront/device-card";
import { DeviceDetail } from "@/components/storefront/device-detail";
import { DemoRibbon } from "@/components/storefront/shop-header";
import { DeviceDetailSkeleton } from "@/components/storefront/skeletons";
import { StorefrontFooter } from "@/components/storefront/storefront-footer";
import { Button } from "@/components/ui/button";
import { CONDITION_LABEL } from "@/lib/catalog";
import { devicePath, deviceSpecLine, deviceTitle, shortIdFromSlug } from "@/lib/device";
import { site, siteUrl } from "@/lib/site";
import type { PublicDevice, PublicShop } from "@/lib/types";
import { requestNow } from "@/server/clock";
import { jsonLd, loadPublicDevice, loadPublicDevices, loadPublicShop } from "@/server/public-data";

type Props = PageProps<"/shop/[shopSlug]/[deviceSlug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { shopSlug, deviceSlug } = await params;
  const shop = await loadPublicShop(shopSlug);
  if (!shop) return { title: "Storefront not found", robots: { index: false, follow: false } };

  const device = await loadPublicDevice(shopSlug, shortIdFromSlug(deviceSlug));
  if (!device) {
    return { title: { absolute: `No longer listed · ${shop.name}` }, robots: { index: false, follow: true } };
  }

  const title = `${deviceTitle(device)}, ${deviceSpecLine(device)} · ${shop.name}`;
  const facts = [
    CONDITION_LABEL[device.condition] + " condition",
    device.batteryHealth !== null ? `battery health ${device.batteryHealth}%` : null,
    device.availability === "available" ? "available now" : device.availability,
  ].filter(Boolean);
  const description = `${deviceTitle(device)} (${deviceSpecLine(device)}) at ${shop.name}${
    shop.location ? `, ${shop.location}` : ""
  }: ${facts.join(", ")}.`;
  const path = devicePath(shop.slug, device);

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    robots: shop.isDemo || device.availability === "sold" ? { index: false, follow: true } : undefined,
    openGraph: { type: "website", title, description, url: path, siteName: site.name },
    twitter: { card: "summary", title, description },
  };
}

export default function DevicePage({ params }: Props) {
  return (
    <Suspense fallback={<DeviceDetailSkeleton />}>
      <DeviceContent params={params} />
    </Suspense>
  );
}

function relatedTo(device: PublicDevice, catalog: PublicDevice[]): PublicDevice[] {
  const others = catalog.filter((item) => item.id !== device.id && item.availability === "available");
  const sameBrand = others.filter((item) => item.brand === device.brand);
  const rest = others.filter((item) => item.brand !== device.brand);
  return [...sameBrand, ...rest].slice(0, 4);
}

async function DeviceContent({ params }: Pick<Props, "params">) {
  const { shopSlug, deviceSlug } = await params;
  const shop = await loadPublicShop(shopSlug);
  if (!shop) notFound();

  const [device, catalog] = await Promise.all([
    loadPublicDevice(shopSlug, shortIdFromSlug(deviceSlug)),
    loadPublicDevices(shopSlug),
  ]);

  if (!device) return <DeviceUnavailable shop={shop} catalog={catalog} />;
  const serverNow = await requestNow();

  const structured = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${deviceTitle(device)} ${deviceSpecLine(device)}`,
    brand: { "@type": "Brand", name: device.brand },
    color: device.colour,
    sku: device.reference,
    itemCondition: "https://schema.org/UsedCondition",
    ...(device.price !== null
      ? {
          offers: {
            "@type": "Offer",
            price: device.price,
            priceCurrency: "INR",
            availability:
              device.availability === "available" ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            url: `${siteUrl()}${devicePath(shop.slug, device)}`,
            seller: { "@type": "Store", name: shop.name },
          },
        }
      : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structured) }} />
      <DeviceDetail shop={shop} device={device} related={relatedTo(device, catalog)} serverNow={serverNow} />
    </>
  );
}

/** A removed, hidden or mistyped device link: explain, then show live stock. */
function DeviceUnavailable({ shop, catalog }: { shop: PublicShop; catalog: PublicDevice[] }) {
  const available = catalog.filter((device) => device.availability === "available").slice(0, 8);
  return (
    <div className="flex min-h-dvh flex-col">
      {shop.isDemo ? <DemoRibbon /> : null}
      <main className="container-page flex-1 pb-20 pt-10 sm:pt-16">
        <div className="mx-auto max-w-lg text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border bg-surface text-muted-foreground shadow-sm">
            <PackageX className="size-6" />
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">This phone is no longer listed</h1>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-6 text-muted-foreground">
            It may have been sold or removed by {shop.name}.
            {available.length > 0 ? " Here is what the shop has in stock right now." : ""}
          </p>
          <Button asChild size="lg" className="mt-7">
            <Link href={`/shop/${shop.slug}`}>Browse {shop.name}</Link>
          </Button>
        </div>
        {available.length > 0 ? (
          <ul className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {available.map((device) => (
              <li key={device.id} className="flex">
                <DeviceCard device={device} shopSlug={shop.slug} className="w-full" />
              </li>
            ))}
          </ul>
        ) : null}
      </main>
      <StorefrontFooter shop={shop} />
    </div>
  );
}
