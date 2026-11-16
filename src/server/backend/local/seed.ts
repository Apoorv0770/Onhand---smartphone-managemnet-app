import { randomUUID } from "node:crypto";
import { deviceLabel } from "@/lib/device";
import type { Activity, Business, Device } from "@/lib/types";
import { DEFAULT_DEMO_PASSWORD, SEED_BUSINESSES } from "../seed-data";
import { createShortId, hashPassword } from "./crypto";
import type { LocalDb, LocalMember, LocalUser } from "./db";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Builds the initial demo database: three fictional retailers with inventory. */
export function createSeedDatabase(now: number = Date.now()): LocalDb {
  const password = process.env.DEMO_PASSWORD?.trim() || DEFAULT_DEMO_PASSWORD;
  const passwordHash = hashPassword(password);

  const users: LocalUser[] = [];
  const businesses: Business[] = [];
  const members: LocalMember[] = [];
  const devices: Device[] = [];
  const activity: Activity[] = [];

  for (const seed of SEED_BUSINESSES) {
    const createdAt = new Date(now - seed.createdDaysAgo * DAY).toISOString();

    const user: LocalUser = {
      id: randomUUID(),
      name: seed.owner.name,
      email: seed.owner.email,
      createdAt,
      passwordHash,
    };
    users.push(user);

    const business: Business = {
      id: randomUUID(),
      ownerId: user.id,
      name: seed.name,
      slug: seed.slug,
      logoUrl: null,
      bannerUrl: null,
      description: seed.description,
      location: seed.location,
      whatsappNumber: seed.whatsappNumber,
      phoneNumber: seed.phoneNumber,
      instagramHandle: seed.instagramHandle,
      settings: {
        showPricesByDefault: seed.showPricesByDefault,
        showSoldDevices: seed.showSoldDevices,
        coverStyle: seed.coverStyle,
        hours: seed.hours,
        onboardingCompletedAt: createdAt,
      },
      isDemo: true,
      createdAt,
    };
    businesses.push(business);
    members.push({ businessId: business.id, userId: user.id, role: "owner", createdAt });

    activity.push({
      id: randomUUID(),
      businessId: business.id,
      deviceId: null,
      action: "business_created",
      subject: business.name,
      reference: null,
      performedBy: user.id,
      performedByName: user.name,
      timestamp: createdAt,
    });

    for (const item of seed.devices) {
      const added = new Date(now - item.addedHoursAgo * HOUR).toISOString();
      const sold = item.soldHoursAgo !== undefined ? new Date(now - item.soldHoursAgo * HOUR).toISOString() : null;

      const device: Device = {
        id: randomUUID(),
        shortId: createShortId(),
        businessId: business.id,
        inventoryReference: item.ref,
        brand: item.brand,
        model: item.model,
        storageGb: item.storageGb,
        colour: item.colour,
        batteryHealth: item.battery,
        condition: item.condition,
        cosmeticCondition: item.cosmetic,
        functionalCondition: item.functional,
        accessories: item.accessories,
        warranty: item.warranty,
        notes: item.notes,
        price: item.price,
        showPrice: item.showPrice,
        availabilityStatus: item.status,
        images: [],
        createdAt: added,
        updatedAt: sold ?? added,
        soldAt: sold,
      };
      devices.push(device);

      const subject = deviceLabel(device);
      activity.push({
        id: randomUUID(),
        businessId: business.id,
        deviceId: device.id,
        action: "device_added",
        subject,
        reference: device.inventoryReference,
        performedBy: user.id,
        performedByName: user.name,
        timestamp: added,
      });
      if (sold) {
        activity.push({
          id: randomUUID(),
          businessId: business.id,
          deviceId: device.id,
          action: "device_sold",
          subject,
          reference: device.inventoryReference,
          performedBy: user.id,
          performedByName: user.name,
          timestamp: sold,
        });
      }
    }
  }

  return {
    version: 1,
    createdAt: new Date(now).toISOString(),
    users,
    sessions: [],
    businesses,
    members,
    devices,
    activity,
    events: {},
  };
}
