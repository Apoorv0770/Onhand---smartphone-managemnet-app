import { AVAILABILITY_RANK } from "@/lib/catalog";
import type { Business, Device, PublicDevice, PublicShop } from "@/lib/types";

/* ---------------------------------------------------------------------------
   The only place private records are turned into public ones.
   Anything not copied here cannot reach a storefront: internal notes, hidden
   prices, database ids, owner ids and settings all stay behind.
--------------------------------------------------------------------------- */

export function toPublicShop(business: Business): PublicShop {
  return {
    name: business.name,
    slug: business.slug,
    logoUrl: business.logoUrl,
    bannerUrl: business.bannerUrl,
    description: business.description,
    location: business.location,
    whatsappNumber: business.whatsappNumber,
    phoneNumber: business.phoneNumber,
    instagramHandle: business.instagramHandle,
    coverStyle: business.settings.coverStyle,
    hours: business.settings.hours,
    isDemo: business.isDemo,
  };
}

export function toPublicDevice(device: Device): PublicDevice {
  const priceIsPublic = device.showPrice && device.price !== null && device.availabilityStatus !== "sold";
  return {
    id: device.shortId,
    reference: device.inventoryReference,
    brand: device.brand,
    model: device.model,
    storageGb: device.storageGb,
    colour: device.colour,
    batteryHealth: device.batteryHealth,
    condition: device.condition,
    cosmeticCondition: device.cosmeticCondition,
    functionalCondition: device.functionalCondition,
    accessories: [...device.accessories],
    warranty: device.warranty,
    availability: device.availabilityStatus,
    price: priceIsPublic ? device.price : null,
    images: [...device.images]
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder)
      .map((image) => ({ url: image.url, isPrimary: image.isPrimary })),
    addedAt: device.createdAt,
  };
}

/** Which of a shop's devices a customer may see, in catalog order. */
export function publicDevicesFor(business: Business, devices: Device[]): PublicDevice[] {
  return devices
    .filter((device) => business.settings.showSoldDevices || device.availabilityStatus !== "sold")
    .sort(
      (a, b) =>
        AVAILABILITY_RANK[a.availabilityStatus] - AVAILABILITY_RANK[b.availabilityStatus] ||
        b.createdAt.localeCompare(a.createdAt),
    )
    .map(toPublicDevice);
}
