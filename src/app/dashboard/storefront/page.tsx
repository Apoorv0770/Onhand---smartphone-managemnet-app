import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader, Panel } from "@/components/dashboard/page-header";
import { ShareLink } from "@/components/dashboard/share-card";
import { FormSkeleton } from "@/components/dashboard/skeletons";
import { StorefrontForm } from "@/components/dashboard/storefront-form";
import { defaultHours } from "@/lib/catalog";
import { localPhonePart } from "@/lib/format";
import type { StorefrontFormValues } from "@/lib/schemas";
import { requireBusiness } from "@/server/session";

export const metadata: Metadata = { title: "Storefront" };

export default function StorefrontSettingsPage() {
  return (
    <>
      <PageHeader
        title="Storefront"
        description="Your public catalog: what it says, how it looks and how customers reach you."
      />
      <Suspense fallback={<FormSkeleton sections={4} />}>
        <StorefrontSettings />
      </Suspense>
    </>
  );
}

async function StorefrontSettings() {
  const { business } = await requireBusiness();

  const defaults: StorefrontFormValues = {
    name: business.name,
    slug: business.slug,
    description: business.description,
    location: business.location,
    whatsappNumber: localPhonePart(business.whatsappNumber),
    phoneNumber: localPhonePart(business.phoneNumber),
    instagramHandle: business.instagramHandle ?? "",
    logoUrl: business.logoUrl,
    bannerUrl: business.bannerUrl,
    coverStyle: business.settings.coverStyle,
    hoursEnabled: business.settings.hours !== null,
    hours: business.settings.hours ?? defaultHours(),
    showPricesByDefault: business.settings.showPricesByDefault,
    showSoldDevices: business.settings.showSoldDevices,
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-8">
      <div className="order-2 min-w-0 lg:order-1">
        <StorefrontForm key={business.slug} defaults={defaults} />
      </div>
      <div className="order-1 lg:order-2">
        <div className="lg:sticky lg:top-20">
          <Panel title="Your storefront link" description="This is the link customers open.">
            <ShareLink slug={business.slug} shopName={business.name} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
