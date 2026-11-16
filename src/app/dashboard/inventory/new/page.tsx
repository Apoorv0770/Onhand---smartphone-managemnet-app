import type { Metadata } from "next";
import { Suspense } from "react";
import { DeviceForm, type DeviceFormDefaults } from "@/components/dashboard/device-form";
import { PageHeader } from "@/components/dashboard/page-header";
import { FormSkeleton } from "@/components/dashboard/skeletons";
import { istDay } from "@/lib/format";
import { getBackend } from "@/server/backend";
import { requestNow } from "@/server/clock";
import { requireBusiness } from "@/server/session";

export const metadata: Metadata = { title: "Add a device" };

export default function NewDevicePage() {
  return (
    <>
      <PageHeader
        title="Add a device"
        description="One record per physical phone. Only brand, model, storage, colour and condition are required."
        back={{ href: "/dashboard/inventory", label: "Inventory" }}
      />
      <Suspense fallback={<FormSkeleton />}>
        <NewDevice />
      </Suspense>
    </>
  );
}

async function NewDevice() {
  const { user, business } = await requireBusiness();
  const backend = await getBackend();
  const reference = await backend.suggestReference(user.id, business.id);
  const today = istDay(await requestNow());

  const defaults: DeviceFormDefaults = {
    brand: "",
    model: "",
    storageGb: 128,
    colour: "",
    batteryHealth: null,
    cosmeticCondition: "",
    functionalCondition: "",
    accessories: [],
    warranty: "",
    notes: "",
    price: null,
    showPrice: business.settings.showPricesByDefault,
    availabilityStatus: "available",
    inventoryReference: reference,
    addedOn: today,
    images: [],
  };

  return <DeviceForm mode="create" defaults={defaults} today={today} shopSlug={business.slug} />;
}
