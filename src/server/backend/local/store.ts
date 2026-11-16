import "server-only";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { deviceLabel, nextReference, referencePrefix } from "@/lib/device";
import { istDay, istDayToIso } from "@/lib/format";
import { RESERVED_SLUGS } from "@/lib/schemas";
import type {
  Activity,
  ActivityAction,
  Analytics,
  AnalyticsDay,
  AvailabilityStatus,
  Business,
  BusinessInput,
  Device,
  DeviceImage,
  DeviceImageInput,
  DeviceInput,
  PublicDevice,
  PublicShop,
  StorefrontEventType,
  StorefrontSettingsInput,
  User,
} from "@/lib/types";
import { AppError } from "@/server/errors";
import { publicDevicesFor, toPublicDevice, toPublicShop } from "../public";
import type { UploadedImage } from "../types";
import { createShortId, createToken, hashPassword, hashToken, verifyPassword } from "./crypto";
import { clone, mutate, read, uploadsDir, type LocalDb, type LocalUser } from "./db";

/* ---------------------------------------------------------------------------
   Demo-mode store.

   Tenant isolation lives here: every private operation first proves that the
   acting user is a member of the business, and every device lookup is scoped
   to that business. A device id from another tenant simply does not resolve.
--------------------------------------------------------------------------- */

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ACTIVITY = 2000;
const MAX_EVENT_DAYS = 120;
const MEDIA_PREFIX = "/media/";

const EXTENSIONS: Record<UploadedImage["contentType"], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/* --------------------------------- Helpers -------------------------------- */

function toUser(user: LocalUser): User {
  return { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt };
}

function nowIso(): string {
  return new Date().toISOString();
}

function memberBusiness(db: LocalDb, userId: string, businessId: string): Business {
  const isMember = db.members.some((member) => member.businessId === businessId && member.userId === userId);
  const business = db.businesses.find((candidate) => candidate.id === businessId);
  if (!isMember || !business) {
    throw new AppError("forbidden", "You don't have access to this business.");
  }
  return business;
}

function ownDevice(db: LocalDb, businessId: string, deviceId: string): Device {
  const device = db.devices.find((candidate) => candidate.id === deviceId && candidate.businessId === businessId);
  if (!device) throw new AppError("not_found", "That device is no longer in your inventory.");
  return device;
}

function log(
  db: LocalDb,
  entry: {
    businessId: string;
    deviceId: string | null;
    action: ActivityAction;
    subject: string;
    reference: string | null;
    userId: string;
  },
): void {
  const user = db.users.find((candidate) => candidate.id === entry.userId);
  const activity: Activity = {
    id: randomUUID(),
    businessId: entry.businessId,
    deviceId: entry.deviceId,
    action: entry.action,
    subject: entry.subject,
    reference: entry.reference,
    performedBy: entry.userId,
    performedByName: user?.name ?? "Someone",
    timestamp: nowIso(),
  };
  db.activity.push(activity);
  if (db.activity.length > MAX_ACTIVITY) db.activity.splice(0, db.activity.length - MAX_ACTIVITY);
}

function slugTaken(db: LocalDb, slug: string, exceptBusinessId?: string): boolean {
  return db.businesses.some((business) => business.slug === slug && business.id !== exceptBusinessId);
}

function assertReferenceFree(db: LocalDb, businessId: string, reference: string, exceptDeviceId?: string): void {
  const wanted = reference.trim().toLowerCase();
  const clash = db.devices.some(
    (device) =>
      device.businessId === businessId &&
      device.id !== exceptDeviceId &&
      device.inventoryReference.trim().toLowerCase() === wanted,
  );
  if (clash) {
    throw new AppError("conflict", "Another device already uses this reference.", {
      inventoryReference: "Another device already uses this reference.",
    });
  }
}

function ownsUpload(businessId: string, url: string): boolean {
  return new RegExp(`^${MEDIA_PREFIX}${businessId}/[a-f0-9-]{36}\\.(jpg|png|webp)$`).test(url);
}

function removeUpload(url: string | null | undefined): void {
  if (!url || !url.startsWith(MEDIA_PREFIX)) return;
  const relative = url.slice(MEDIA_PREFIX.length);
  if (!/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(relative)) return;
  try {
    fs.rmSync(path.join(/* turbopackIgnore: true */ uploadsDir(), relative), { force: true });
  } catch {
    // A leftover file is harmless. Never fail a request over cleanup.
  }
}

function buildImages(businessId: string, existing: DeviceImage[], inputs: DeviceImageInput[]): DeviceImage[] {
  const primaryIndex = Math.max(
    0,
    inputs.findIndex((image) => image.isPrimary),
  );
  return inputs.map((input, index) => {
    const previous = existing.find((image) => image.url === input.url);
    if (!previous && !ownsUpload(businessId, input.url)) {
      throw new AppError("validation", "One of the photos could not be attached. Please upload it again.", {
        images: "One of the photos could not be attached. Please upload it again.",
      });
    }
    return {
      id: previous?.id ?? randomUUID(),
      url: input.url,
      sortOrder: index,
      isPrimary: index === primaryIndex,
    };
  });
}

function createdAtFor(addedOn: string, fallbackIso: string): string {
  const today = istDay(Date.now());
  if (addedOn >= today) return fallbackIso;
  return istDayToIso(addedOn);
}

function statusAction(status: AvailabilityStatus): ActivityAction {
  if (status === "sold") return "device_sold";
  if (status === "reserved") return "device_reserved";
  return "device_available";
}

/* ---------------------------------- Auth ---------------------------------- */

export function createUser(input: { name: string; email: string; password: string }): User {
  const email = input.email.trim().toLowerCase();
  return mutate((db) => {
    if (db.users.some((user) => user.email === email)) {
      throw new AppError("conflict", "An account with this email already exists.", {
        email: "An account with this email already exists.",
      });
    }
    const user: LocalUser = {
      id: randomUUID(),
      name: input.name.trim(),
      email,
      createdAt: nowIso(),
      passwordHash: hashPassword(input.password),
    };
    db.users.push(user);
    return toUser(user);
  });
}

// Compared against when the email is unknown, so timing does not reveal it.
const DUMMY_HASH = ["scrypt", "0".repeat(32), "0".repeat(128)].join("$");

export function verifyCredentials(email: string, password: string): User | null {
  const wanted = email.trim().toLowerCase();
  return read((db) => {
    const user = db.users.find((candidate) => candidate.email === wanted);
    if (!user) {
      verifyPassword(password, DUMMY_HASH);
      return null;
    }
    return verifyPassword(password, user.passwordHash) ? toUser(user) : null;
  });
}

export function createSession(userId: string): string {
  const token = createToken();
  mutate((db) => {
    const now = Date.now();
    db.sessions = db.sessions.filter((session) => new Date(session.expiresAt).getTime() > now);
    db.sessions.push({
      tokenHash: hashToken(token),
      userId,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
    });
  });
  return token;
}

export function getUserBySession(token: string): User | null {
  if (!token) return null;
  const tokenHash = hashToken(token);
  return read((db) => {
    const session = db.sessions.find((candidate) => candidate.tokenHash === tokenHash);
    if (!session || new Date(session.expiresAt).getTime() <= Date.now()) return null;
    const user = db.users.find((candidate) => candidate.id === session.userId);
    return user ? toUser(user) : null;
  });
}

export function deleteSession(token: string): void {
  if (!token) return;
  const tokenHash = hashToken(token);
  mutate((db) => {
    db.sessions = db.sessions.filter((session) => session.tokenHash !== tokenHash);
  });
}

export function updateUser(userId: string, input: { name: string }): User {
  return mutate((db) => {
    const user = db.users.find((candidate) => candidate.id === userId);
    if (!user) throw new AppError("not_found", "Account not found.");
    user.name = input.name.trim();
    return toUser(user);
  });
}

/* -------------------------------- Business -------------------------------- */

export function getBusinessForUser(userId: string): Business | null {
  return read((db) => {
    const membership = db.members
      .filter((member) => member.userId === userId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    if (!membership) return null;
    const business = db.businesses.find((candidate) => candidate.id === membership.businessId);
    return business ? clone(business) : null;
  });
}

export function isSlugAvailable(slug: string, exceptBusinessId?: string): boolean {
  if (RESERVED_SLUGS.has(slug)) return false;
  return read((db) => !slugTaken(db, slug, exceptBusinessId));
}

export function createBusiness(userId: string, input: BusinessInput): Business {
  return mutate((db) => {
    if (!db.users.some((user) => user.id === userId)) {
      throw new AppError("unauthenticated", "Please sign in again.");
    }
    if (db.members.some((member) => member.userId === userId)) {
      throw new AppError("conflict", "Your account already has a storefront.");
    }
    if (RESERVED_SLUGS.has(input.slug) || slugTaken(db, input.slug)) {
      throw new AppError("conflict", "That storefront address is already taken.", {
        slug: "That storefront address is already taken.",
      });
    }
    const createdAt = nowIso();
    const business: Business = {
      id: randomUUID(),
      ownerId: userId,
      name: input.name,
      slug: input.slug,
      logoUrl: null,
      bannerUrl: null,
      description: input.description,
      location: input.location,
      whatsappNumber: input.whatsappNumber,
      phoneNumber: input.phoneNumber,
      instagramHandle: input.instagramHandle,
      settings: {
        showPricesByDefault: true,
        showSoldDevices: true,
        coverStyle: "graphite",
        hours: null,
        onboardingCompletedAt: null,
      },
      isDemo: false,
      createdAt,
    };
    db.businesses.push(business);
    db.members.push({ businessId: business.id, userId, role: "owner", createdAt });
    log(db, {
      businessId: business.id,
      deviceId: null,
      action: "business_created",
      subject: business.name,
      reference: null,
      userId,
    });
    return clone(business);
  });
}

export function updateStorefront(userId: string, businessId: string, input: StorefrontSettingsInput): Business {
  const stale: (string | null)[] = [];
  const updated = mutate((db) => {
    const business = memberBusiness(db, userId, businessId);
    if (input.slug !== business.slug && (RESERVED_SLUGS.has(input.slug) || slugTaken(db, input.slug, businessId))) {
      throw new AppError("conflict", "That storefront address is already taken.", {
        slug: "That storefront address is already taken.",
      });
    }
    for (const [field, url, current] of [
      ["logoUrl", input.logoUrl, business.logoUrl],
      ["bannerUrl", input.bannerUrl, business.bannerUrl],
    ] as const) {
      if (url && url !== current && !ownsUpload(businessId, url)) {
        throw new AppError("validation", "That image could not be used. Please upload it again.", {
          [field]: "That image could not be used. Please upload it again.",
        });
      }
    }
    if (business.logoUrl && business.logoUrl !== input.logoUrl) stale.push(business.logoUrl);
    if (business.bannerUrl && business.bannerUrl !== input.bannerUrl) stale.push(business.bannerUrl);

    business.name = input.name;
    business.slug = input.slug;
    business.description = input.description;
    business.location = input.location;
    business.whatsappNumber = input.whatsappNumber;
    business.phoneNumber = input.phoneNumber;
    business.instagramHandle = input.instagramHandle;
    business.logoUrl = input.logoUrl;
    business.bannerUrl = input.bannerUrl;
    business.settings = {
      ...business.settings,
      coverStyle: input.coverStyle,
      hours: input.hours,
      showPricesByDefault: input.showPricesByDefault,
      showSoldDevices: input.showSoldDevices,
    };
    log(db, {
      businessId,
      deviceId: null,
      action: "storefront_updated",
      subject: business.name,
      reference: null,
      userId,
    });
    return clone(business);
  });
  stale.forEach(removeUpload);
  return updated;
}

export function completeOnboarding(userId: string, businessId: string): Business {
  return mutate((db) => {
    const business = memberBusiness(db, userId, businessId);
    if (!business.settings.onboardingCompletedAt) {
      business.settings.onboardingCompletedAt = nowIso();
    }
    return clone(business);
  });
}

/* --------------------------------- Devices -------------------------------- */

export function listDevices(userId: string, businessId: string): Device[] {
  return read((db) => {
    memberBusiness(db, userId, businessId);
    return clone(
      db.devices
        .filter((device) => device.businessId === businessId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  });
}

export function getDevice(userId: string, businessId: string, deviceId: string): Device | null {
  return read((db) => {
    memberBusiness(db, userId, businessId);
    const device = db.devices.find((candidate) => candidate.id === deviceId && candidate.businessId === businessId);
    return device ? clone(device) : null;
  });
}

export function suggestReference(userId: string, businessId: string): string {
  return read((db) => {
    const business = memberBusiness(db, userId, businessId);
    const existing = db.devices
      .filter((device) => device.businessId === businessId)
      .map((device) => device.inventoryReference);
    return nextReference(referencePrefix(business.name), existing);
  });
}

export function createDevice(userId: string, businessId: string, input: DeviceInput): Device {
  return mutate((db) => {
    memberBusiness(db, userId, businessId);
    assertReferenceFree(db, businessId, input.inventoryReference);
    const now = nowIso();
    const device: Device = {
      id: randomUUID(),
      shortId: createShortId(),
      businessId,
      inventoryReference: input.inventoryReference.trim(),
      brand: input.brand,
      model: input.model,
      storageGb: input.storageGb,
      colour: input.colour,
      batteryHealth: input.batteryHealth,
      condition: input.condition,
      cosmeticCondition: input.cosmeticCondition,
      functionalCondition: input.functionalCondition,
      accessories: input.accessories,
      warranty: input.warranty,
      notes: input.notes,
      price: input.price,
      showPrice: input.showPrice,
      availabilityStatus: input.availabilityStatus,
      images: buildImages(businessId, [], input.images),
      createdAt: createdAtFor(input.addedOn, now),
      updatedAt: now,
      soldAt: input.availabilityStatus === "sold" ? now : null,
    };
    db.devices.push(device);
    log(db, {
      businessId,
      deviceId: device.id,
      action: "device_added",
      subject: deviceLabel(device),
      reference: device.inventoryReference,
      userId,
    });
    return clone(device);
  });
}

export function updateDevice(userId: string, businessId: string, deviceId: string, input: DeviceInput): Device {
  const stale: string[] = [];
  const updated = mutate((db) => {
    memberBusiness(db, userId, businessId);
    const device = ownDevice(db, businessId, deviceId);
    assertReferenceFree(db, businessId, input.inventoryReference, deviceId);

    const now = nowIso();
    const images = buildImages(businessId, device.images, input.images);
    for (const image of device.images) {
      if (!images.some((kept) => kept.url === image.url)) stale.push(image.url);
    }

    const statusChanged = device.availabilityStatus !== input.availabilityStatus;
    const priceVisibilityChanged = device.showPrice !== input.showPrice;

    device.inventoryReference = input.inventoryReference.trim();
    device.brand = input.brand;
    device.model = input.model;
    device.storageGb = input.storageGb;
    device.colour = input.colour;
    device.batteryHealth = input.batteryHealth;
    device.condition = input.condition;
    device.cosmeticCondition = input.cosmeticCondition;
    device.functionalCondition = input.functionalCondition;
    device.accessories = input.accessories;
    device.warranty = input.warranty;
    device.notes = input.notes;
    device.price = input.price;
    device.showPrice = input.showPrice;
    device.images = images;
    if (input.addedOn !== istDay(device.createdAt)) {
      device.createdAt = createdAtFor(input.addedOn, now);
    }
    if (statusChanged) {
      device.availabilityStatus = input.availabilityStatus;
      device.soldAt = input.availabilityStatus === "sold" ? now : null;
    }
    device.updatedAt = now;

    const subject = deviceLabel(device);
    const base = { businessId, deviceId, subject, reference: device.inventoryReference, userId };
    log(db, { ...base, action: "device_updated" });
    if (statusChanged) log(db, { ...base, action: statusAction(device.availabilityStatus) });
    if (priceVisibilityChanged) log(db, { ...base, action: device.showPrice ? "price_shown" : "price_hidden" });
    return clone(device);
  });
  stale.forEach(removeUpload);
  return updated;
}

export function setAvailability(
  userId: string,
  businessId: string,
  deviceId: string,
  status: AvailabilityStatus,
): Device {
  return mutate((db) => {
    memberBusiness(db, userId, businessId);
    const device = ownDevice(db, businessId, deviceId);
    if (device.availabilityStatus !== status) {
      const now = nowIso();
      device.availabilityStatus = status;
      device.soldAt = status === "sold" ? now : null;
      device.updatedAt = now;
      log(db, {
        businessId,
        deviceId,
        action: statusAction(status),
        subject: deviceLabel(device),
        reference: device.inventoryReference,
        userId,
      });
    }
    return clone(device);
  });
}

export function setPriceVisibility(userId: string, businessId: string, deviceId: string, showPrice: boolean): Device {
  return mutate((db) => {
    memberBusiness(db, userId, businessId);
    const device = ownDevice(db, businessId, deviceId);
    if (device.showPrice !== showPrice) {
      device.showPrice = showPrice;
      device.updatedAt = nowIso();
      log(db, {
        businessId,
        deviceId,
        action: showPrice ? "price_shown" : "price_hidden",
        subject: deviceLabel(device),
        reference: device.inventoryReference,
        userId,
      });
    }
    return clone(device);
  });
}

export function deleteDevice(userId: string, businessId: string, deviceId: string): void {
  const stale: string[] = [];
  mutate((db) => {
    memberBusiness(db, userId, businessId);
    const device = ownDevice(db, businessId, deviceId);
    stale.push(...device.images.map((image) => image.url));
    db.devices = db.devices.filter((candidate) => candidate.id !== deviceId);
    for (const entry of db.activity) {
      if (entry.deviceId === deviceId) entry.deviceId = null;
    }
    log(db, {
      businessId,
      deviceId: null,
      action: "device_deleted",
      subject: deviceLabel(device),
      reference: device.inventoryReference,
      userId,
    });
  });
  stale.forEach(removeUpload);
}

/* ---------------------------------- Media --------------------------------- */

export function saveImage(userId: string, businessId: string, image: UploadedImage): { url: string } {
  read((db) => memberBusiness(db, userId, businessId));
  const extension = EXTENSIONS[image.contentType];
  if (!extension) throw new AppError("validation", "Use a JPG, PNG or WebP image.");
  const directory = path.join(/* turbopackIgnore: true */ uploadsDir(), businessId);
  fs.mkdirSync(directory, { recursive: true });
  const name = `${randomUUID()}.${extension}`;
  fs.writeFileSync(path.join(/* turbopackIgnore: true */ directory, name), image.bytes);
  return { url: `${MEDIA_PREFIX}${businessId}/${name}` };
}

/** Resolves a /media path to a file on disk, or null if it is not a valid upload. */
export function resolveUpload(segments: string[]): { file: string; contentType: string } | null {
  if (segments.length !== 2) return null;
  const [businessId, name] = segments;
  if (!/^[a-f0-9-]{36}$/.test(businessId)) return null;
  const match = /^[a-f0-9-]{36}\.(jpg|png|webp)$/.exec(name);
  if (!match) return null;
  const file = path.join(/* turbopackIgnore: true */ uploadsDir(), businessId, name);
  if (!fs.existsSync(file)) return null;
  const contentType = match[1] === "jpg" ? "image/jpeg" : `image/${match[1]}`;
  return { file, contentType };
}

/* --------------------------- Activity and analytics ----------------------- */

export function listActivity(userId: string, businessId: string, limit: number): Activity[] {
  return read((db) => {
    memberBusiness(db, userId, businessId);
    return clone(
      db.activity
        .filter((entry) => entry.businessId === businessId)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, limit),
    );
  });
}

export function getAnalytics(userId: string, businessId: string, days: number): Analytics {
  return read((db) => {
    memberBusiness(db, userId, businessId);
    const byDay = db.events[businessId] ?? {};
    const result: AnalyticsDay[] = [];
    const inquiriesByDevice: Record<string, number> = {};
    const now = Date.now();
    for (let offset = days - 1; offset >= 0; offset--) {
      const day = istDay(now - offset * 24 * 60 * 60 * 1000);
      const counters = byDay[day];
      result.push({ day, views: counters?.views ?? 0, inquiries: counters?.inquiries ?? 0 });
      for (const [shortId, count] of Object.entries(counters?.devices ?? {})) {
        inquiriesByDevice[shortId] = (inquiriesByDevice[shortId] ?? 0) + count;
      }
    }
    return {
      days: result,
      totalViews: result.reduce((sum, day) => sum + day.views, 0),
      totalInquiries: result.reduce((sum, day) => sum + day.inquiries, 0),
      inquiriesByDevice,
    };
  });
}

export function recordEvent(slug: string, type: StorefrontEventType, deviceShortId?: string | null): void {
  const exists = read((db) => db.businesses.some((business) => business.slug === slug));
  if (!exists) return;
  mutate((db) => {
    const business = db.businesses.find((candidate) => candidate.slug === slug);
    if (!business) return;
    const day = istDay(Date.now());
    const days = (db.events[business.id] ??= {});
    const counters = (days[day] ??= { views: 0, inquiries: 0, devices: {} });
    if (type === "view") {
      counters.views += 1;
    } else {
      counters.inquiries += 1;
      const device = deviceShortId
        ? db.devices.find((candidate) => candidate.shortId === deviceShortId && candidate.businessId === business.id)
        : null;
      if (device) counters.devices[device.shortId] = (counters.devices[device.shortId] ?? 0) + 1;
    }
    const keys = Object.keys(days).sort();
    for (const key of keys.slice(0, Math.max(0, keys.length - MAX_EVENT_DAYS))) delete days[key];
  });
}

/* ---------------------------------- Public -------------------------------- */

export function getPublicShop(slug: string): PublicShop | null {
  return read((db) => {
    const business = db.businesses.find((candidate) => candidate.slug === slug);
    return business ? toPublicShop(business) : null;
  });
}

export function listPublicDevices(slug: string): PublicDevice[] {
  return read((db) => {
    const business = db.businesses.find((candidate) => candidate.slug === slug);
    if (!business) return [];
    return publicDevicesFor(
      business,
      db.devices.filter((device) => device.businessId === business.id),
    );
  });
}

export function getPublicDevice(slug: string, shortId: string): PublicDevice | null {
  return read((db) => {
    const business = db.businesses.find((candidate) => candidate.slug === slug);
    if (!business) return null;
    const device = db.devices.find(
      (candidate) => candidate.shortId === shortId && candidate.businessId === business.id,
    );
    if (!device) return null;
    if (device.availabilityStatus === "sold" && !business.settings.showSoldDevices) return null;
    return toPublicDevice(device);
  });
}
