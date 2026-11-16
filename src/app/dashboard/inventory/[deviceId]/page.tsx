import { PackageX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DeviceForm, type DeviceFormDefaults } from "@/components/dashboard/device-form";
import { PageHeader } from "@/components/dashboard/page-header";
import { FormSkeleton } from "@/components/dashboard/skeletons";
import { StatusBadge } from "@/components/device/badges";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { deviceLabel } from "@/lib/device";
import { formatDate, istDay } from "@/lib/format";
import { getBackend } from "@/server/backend";
import { requestNow } from "@/server/clock";
import { requireBusiness } from "@/server/session";

export const metadata: Metadata = { title: "Edit device" };

type Props = PageProps<"/dashboard/inventory/[deviceId]">;

export default function EditDevicePage({ params }: Props) {
  return (
    <>
      <PageHeader
        title="Edit device"
        description="Changes appear on your storefront as soon as you save."
        back={{ href: "/dashboard/inventory", label: "Inventory" }}
      />
      <Suspense fallback={<FormSkeleton />}>
        <EditDevice params={params} />
      </Suspense>
    </>
  );
}

async function EditDevice({ params }: Pick<Props, "params">) {
  const { deviceId } = await params;
  const { user, business } = await requireBusiness();
  const backend = await getBackend();
  // Scoped to this retailer's business: another shop's device id resolves to nothing.
  const device = await backend.getDevice(user.id, business.id, deviceId);

  if (!device) {
    return (
      <EmptyState
        icon={<PackageX />}
        title="This device is not in your inventory"
        description="It may have been deleted, or the link may be wrong."
      >
        <Button asChild>
          <Link href="/dashboard/inventory">Back to inventory</Link>
        </Button>
      </EmptyState>
    );
  }

  const today = istDay(await requestNow());

  const defaults: DeviceFormDefaults = {
    brand: device.brand,
    model: device.model,
    storageGb: device.storageGb,
    colour: device.colour,
    condition: device.condition,
    batteryHealth: device.batteryHealth,
    cosmeticCondition: device.cosmeticCondition,
    functionalCondition: device.functionalCondition,
    accessories: device.accessories,
    warranty: device.warranty,
    notes: device.notes,
    price: device.price,
    showPrice: device.showPrice,
    availabilityStatus: device.availabilityStatus,
    inventoryReference: device.inventoryReference,
    addedOn: istDay(device.createdAt),
    images: [...device.images]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((image) => ({ url: image.url, isPrimary: image.isPrimary })),
  };

  return (
    <>
      <div className="-mt-3 mb-6 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-muted-foreground sm:-mt-4">
        <span className="font-medium text-foreground">{deviceLabel(device)}</span>
        <StatusBadge status={device.availabilityStatus} size="sm" />
        <span className="font-mono text-xs">{device.inventoryReference}</span>
        <span>Last updated {formatDate(device.updatedAt)}</span>
      </div>
      <DeviceForm
        key={`${device.id}:${device.updatedAt}`}
        mode="edit"
        defaults={defaults}
        today={today}
        shopSlug={business.slug}
        deviceId={device.id}
        shortId={device.shortId}
      />
    </>
  );
}
