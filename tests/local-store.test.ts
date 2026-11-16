import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { BusinessInput, DeviceInput, StorefrontSettingsInput } from "@/lib/types";

/* ---------------------------------------------------------------------------
   Demo-mode store: tenant isolation, public data hygiene and core workflows.
   Each run uses a throwaway data directory, so the real demo data is untouched.
--------------------------------------------------------------------------- */

type Store = typeof import("@/server/backend/local/store");

let store: Store;
let directory: string;

const PRIVATE_NOTE = "INTERNAL-NOTE-do-not-leak-7731";

function businessInput(name: string, slug: string): BusinessInput {
  return {
    name,
    slug,
    description: "Test shop",
    location: "Amravati, Maharashtra",
    whatsappNumber: "919876543210",
    phoneNumber: null,
    instagramHandle: null,
  };
}

function deviceInput(overrides: Partial<DeviceInput> = {}): DeviceInput {
  return {
    brand: "Apple",
    model: "iPhone 13",
    storageGb: 128,
    colour: "Midnight",
    batteryHealth: 87,
    condition: "good",
    cosmeticCondition: "Light scratches",
    functionalCondition: "All working",
    accessories: ["Charging cable"],
    warranty: "7-day shop warranty",
    notes: PRIVATE_NOTE,
    price: 36500,
    showPrice: true,
    availabilityStatus: "available",
    inventoryReference: "T-0001",
    addedOn: "2099-01-01",
    images: [],
    ...overrides,
  };
}

function storefrontInput(base: BusinessInput, overrides: Partial<StorefrontSettingsInput> = {}): StorefrontSettingsInput {
  return {
    ...base,
    logoUrl: null,
    bannerUrl: null,
    coverStyle: "graphite",
    hours: null,
    showPricesByDefault: true,
    showSoldDevices: true,
    ...overrides,
  };
}

beforeAll(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "onhand-test-"));
  process.env.ONHAND_DATA_DIR = directory;
  store = await import("@/server/backend/local/store");
});

afterAll(() => {
  fs.rmSync(directory, { recursive: true, force: true });
});

describe("demo seed", () => {
  it("creates three fictional storefronts that work without signing in", () => {
    for (const slug of ["urban-mobile-studio", "prime-device-hub", "nextwave-mobiles"]) {
      const shop = store.getPublicShop(slug);
      expect(shop, slug).not.toBeNull();
      expect(shop?.isDemo).toBe(true);
      expect(store.listPublicDevices(slug).length).toBeGreaterThan(0);
    }
  });

  it("never mixes inventory between storefronts", () => {
    const urban = store.listPublicDevices("urban-mobile-studio").map((device) => device.reference);
    const prime = store.listPublicDevices("prime-device-hub").map((device) => device.reference);
    expect(urban.every((reference) => reference.startsWith("UMS-"))).toBe(true);
    expect(prime.every((reference) => reference.startsWith("PDH-"))).toBe(true);
    expect(urban.some((reference) => prime.includes(reference))).toBe(false);
  });

  it("returns nothing for a storefront that does not exist", () => {
    expect(store.getPublicShop("no-such-shop")).toBeNull();
    expect(store.listPublicDevices("no-such-shop")).toEqual([]);
    expect(store.getPublicDevice("no-such-shop", "abc")).toBeNull();
  });

  it("keeps hidden prices and internal notes out of seeded public data", () => {
    const serialised = JSON.stringify(store.listPublicDevices("prime-device-hub"));
    expect(serialised).not.toContain("Do not go below");
    expect(serialised).not.toContain("72000");
    const hidden = store.listPublicDevices("urban-mobile-studio").find((device) => device.reference === "UMS-0009");
    expect(hidden?.price).toBeNull();
  });

  it("lets demo accounts sign in with the documented password", async () => {
    const { DEFAULT_DEMO_PASSWORD } = await import("@/server/backend/seed-data");
    expect(store.verifyCredentials("urban@demo.onhand.example", DEFAULT_DEMO_PASSWORD)).not.toBeNull();
    expect(store.verifyCredentials("urban@demo.onhand.example", "wrong-password")).toBeNull();
    expect(store.verifyCredentials("nobody@demo.onhand.example", DEFAULT_DEMO_PASSWORD)).toBeNull();
  });
});

describe("retailer workflow", () => {
  const alphaInput = businessInput("Alpha Phones", "alpha-phones");
  let ownerId: string;
  let businessId: string;
  const deviceIds: string[] = [];

  it("signs up, signs in and resolves a session", () => {
    const user = store.createUser({ name: "Asha", email: "Asha@Example.com", password: "correct-horse" });
    ownerId = user.id;
    expect(user.email).toBe("asha@example.com");
    expect(() => store.createUser({ name: "Dup", email: "asha@example.com", password: "another-pass" })).toThrow(
      /already exists/,
    );

    const token = store.createSession(user.id);
    expect(store.getUserBySession(token)?.id).toBe(user.id);
    expect(store.getUserBySession("not-a-token")).toBeNull();
    store.deleteSession(token);
    expect(store.getUserBySession(token)).toBeNull();
  });

  it("creates a business with a unique storefront address", () => {
    expect(store.isSlugAvailable("alpha-phones")).toBe(true);
    expect(store.isSlugAvailable("urban-mobile-studio")).toBe(false);
    expect(store.isSlugAvailable("dashboard")).toBe(false);

    const business = store.createBusiness(ownerId, alphaInput);
    businessId = business.id;
    expect(business.slug).toBe("alpha-phones");
    expect(business.isDemo).toBe(false);
    expect(store.isSlugAvailable("alpha-phones")).toBe(false);
    expect(store.isSlugAvailable("alpha-phones", businessId)).toBe(true);
    expect(store.getBusinessForUser(ownerId)?.id).toBe(businessId);
    expect(store.getPublicShop("alpha-phones")?.name).toBe("Alpha Phones");
  });

  it("rejects a storefront address that is already taken", () => {
    const other = store.createUser({ name: "Bela", email: "bela@example.com", password: "correct-horse" });
    expect(() => store.createBusiness(other.id, businessInput("Copycat", "alpha-phones"))).toThrow(/already taken/);
    expect(store.getBusinessForUser(other.id)).toBeNull();
  });

  it("adds three devices that appear on the public storefront", () => {
    expect(store.suggestReference(ownerId, businessId)).toBe("AP-0001");
    deviceIds.push(store.createDevice(ownerId, businessId, deviceInput({ inventoryReference: "AP-0001" })).id);
    deviceIds.push(
      store.createDevice(
        ownerId,
        businessId,
        deviceInput({
          inventoryReference: "AP-0002",
          brand: "Samsung",
          model: "Galaxy S23 Ultra",
          storageGb: 256,
          colour: "Green",
          batteryHealth: null,
          price: 58000,
        }),
      ).id,
    );
    deviceIds.push(
      store.createDevice(
        ownerId,
        businessId,
        deviceInput({ inventoryReference: "AP-0003", model: "iPhone 14 Pro", storageGb: 256, colour: "Deep Purple" }),
      ).id,
    );
    expect(store.suggestReference(ownerId, businessId)).toBe("AP-0004");

    const listed = store.listPublicDevices("alpha-phones");
    expect(listed.map((device) => device.reference).sort()).toEqual(["AP-0001", "AP-0002", "AP-0003"]);
    expect(listed.every((device) => device.availability === "available")).toBe(true);
  });

  it("treats two identical phones as separate inventory records", () => {
    const twin = store.createDevice(ownerId, businessId, deviceInput({ inventoryReference: "AP-0004", batteryHealth: 93 }));
    const sameSpec = store
      .listPublicDevices("alpha-phones")
      .filter((device) => device.model === "iPhone 13" && device.storageGb === 128);
    expect(sameSpec).toHaveLength(2);
    expect(new Set(sameSpec.map((device) => device.batteryHealth))).toEqual(new Set([87, 93]));
    store.deleteDevice(ownerId, businessId, twin.id);
  });

  it("requires a unique inventory reference within a business", () => {
    expect(() => store.createDevice(ownerId, businessId, deviceInput({ inventoryReference: "ap-0001" }))).toThrow(
      /already uses this reference/,
    );
  });

  it("marks a device sold and the storefront reflects it immediately", () => {
    const [first] = deviceIds;
    const sold = store.setAvailability(ownerId, businessId, first, "sold");
    expect(sold.availabilityStatus).toBe("sold");
    expect(sold.soldAt).not.toBeNull();

    const publicDevice = store.listPublicDevices("alpha-phones").find((device) => device.reference === "AP-0001");
    expect(publicDevice?.availability).toBe("sold");
    expect(publicDevice?.price).toBeNull();

    // Sold devices sort after available ones.
    const order = store.listPublicDevices("alpha-phones").map((device) => device.availability);
    expect(order.indexOf("sold")).toBe(order.length - 1);

    const restored = store.setAvailability(ownerId, businessId, first, "available");
    expect(restored.soldAt).toBeNull();
  });

  it("hides sold devices entirely when the shop chooses to", () => {
    const [first] = deviceIds;
    store.setAvailability(ownerId, businessId, first, "sold");
    store.updateStorefront(ownerId, businessId, storefrontInput(alphaInput, { showSoldDevices: false }));
    const listed = store.listPublicDevices("alpha-phones");
    expect(listed.some((device) => device.reference === "AP-0001")).toBe(false);
    const shortId = store.getDevice(ownerId, businessId, first)!.shortId;
    expect(store.getPublicDevice("alpha-phones", shortId)).toBeNull();

    store.updateStorefront(ownerId, businessId, storefrontInput(alphaInput, { showSoldDevices: true }));
    store.setAvailability(ownerId, businessId, first, "available");
    expect(store.getPublicDevice("alpha-phones", shortId)?.availability).toBe("available");
  });

  it("never exposes a hidden price, internal notes or internal ids publicly", () => {
    const [, second] = deviceIds;
    const before = store.listPublicDevices("alpha-phones").find((device) => device.reference === "AP-0002");
    expect(before?.price).toBe(58000);

    store.setPriceVisibility(ownerId, businessId, second, false);

    const shortId = store.getDevice(ownerId, businessId, second)!.shortId;
    const list = JSON.stringify(store.listPublicDevices("alpha-phones"));
    const detail = JSON.stringify(store.getPublicDevice("alpha-phones", shortId));
    const shop = JSON.stringify(store.getPublicShop("alpha-phones"));

    expect(JSON.parse(detail).price).toBeNull();
    for (const payload of [list, detail]) {
      expect(payload).not.toContain("58000");
      expect(payload).not.toContain(PRIVATE_NOTE);
      expect(payload).not.toContain("notes");
      expect(payload).not.toContain("showPrice");
      expect(payload).not.toContain(businessId);
      for (const id of deviceIds) expect(payload).not.toContain(id);
    }
    expect(shop).not.toContain(ownerId);
    expect(shop).not.toContain(businessId);
    expect(shop).not.toContain("settings");

    // The owner still sees the price in the dashboard.
    expect(store.getDevice(ownerId, businessId, second)?.price).toBe(58000);
  });

  it("edits and deletes devices", () => {
    const [, , third] = deviceIds;
    const edited = store.updateDevice(
      ownerId,
      businessId,
      third,
      deviceInput({ inventoryReference: "AP-0003", model: "iPhone 14 Pro Max", storageGb: 512, colour: "Gold", price: 71000 }),
    );
    expect(edited.model).toBe("iPhone 14 Pro Max");
    expect(store.listPublicDevices("alpha-phones").find((device) => device.reference === "AP-0003")?.storageGb).toBe(512);

    store.deleteDevice(ownerId, businessId, third);
    expect(store.getDevice(ownerId, businessId, third)).toBeNull();
    expect(store.listPublicDevices("alpha-phones").some((device) => device.reference === "AP-0003")).toBe(false);
    expect(() => store.deleteDevice(ownerId, businessId, third)).toThrow(/no longer in your inventory/);
  });

  it("rejects image urls that were not uploaded by this business", () => {
    expect(() =>
      store.createDevice(
        ownerId,
        businessId,
        deviceInput({ inventoryReference: "AP-0099", images: [{ url: "https://tracker.example/pixel.png", isPrimary: true }] }),
      ),
    ).toThrow(/could not be attached/);
    // A failed write must leave no partial record behind.
    expect(store.listDevices(ownerId, businessId).some((device) => device.inventoryReference === "AP-0099")).toBe(false);
  });

  it("stores uploaded images and attaches them to a device", () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const first = store.saveImage(ownerId, businessId, { bytes: png, contentType: "image/png" });
    const second = store.saveImage(ownerId, businessId, { bytes: png, contentType: "image/png" });
    expect(first.url).toMatch(new RegExp(`^/media/${businessId}/[a-f0-9-]{36}\\.png$`));

    const device = store.createDevice(
      ownerId,
      businessId,
      deviceInput({
        inventoryReference: "AP-0010",
        images: [
          { url: first.url, isPrimary: false },
          { url: second.url, isPrimary: true },
        ],
      }),
    );
    expect(device.images).toHaveLength(2);
    expect(device.images.filter((image) => image.isPrimary)).toHaveLength(1);
    expect(device.images.find((image) => image.isPrimary)?.url).toBe(second.url);

    const publicDevice = store.getPublicDevice("alpha-phones", device.shortId);
    expect(publicDevice?.images[0].url).toBe(second.url);

    const resolved = store.resolveUpload(first.url.replace("/media/", "").split("/"));
    expect(resolved?.contentType).toBe("image/png");
    expect(store.resolveUpload(["..", "db.json"])).toBeNull();
    expect(store.resolveUpload([businessId, "../../db.json"])).toBeNull();

    store.deleteDevice(ownerId, businessId, device.id);
    expect(store.resolveUpload(first.url.replace("/media/", "").split("/"))).toBeNull();
  });

  it("records activity for what happened", () => {
    const actions = store.listActivity(ownerId, businessId, 100).map((entry) => entry.action);
    for (const expected of ["business_created", "device_added", "device_sold", "price_hidden", "device_deleted"]) {
      expect(actions).toContain(expected);
    }
  });

  it("counts real storefront views and inquiries only", () => {
    const empty = store.getAnalytics(ownerId, businessId, 7);
    expect(empty.totalViews).toBe(0);
    expect(empty.totalInquiries).toBe(0);

    const shortId = store.getDevice(ownerId, businessId, deviceIds[0])!.shortId;
    store.recordEvent("alpha-phones", "view");
    store.recordEvent("alpha-phones", "view");
    store.recordEvent("alpha-phones", "inquiry", shortId);
    store.recordEvent("no-such-shop", "view");

    const analytics = store.getAnalytics(ownerId, businessId, 7);
    expect(analytics.totalViews).toBe(2);
    expect(analytics.totalInquiries).toBe(1);
    expect(analytics.inquiriesByDevice[shortId]).toBe(1);
    expect(analytics.days).toHaveLength(7);
  });
});

describe("tenant isolation", () => {
  let alphaOwner: string;
  let alphaBusiness: string;
  let alphaDevice: string;
  let betaOwner: string;
  let betaBusiness: string;

  beforeAll(() => {
    alphaOwner = store.verifyCredentials("asha@example.com", "correct-horse")!.id;
    alphaBusiness = store.getBusinessForUser(alphaOwner)!.id;
    alphaDevice = store.listDevices(alphaOwner, alphaBusiness)[0].id;

    const beta = store.createUser({ name: "Bhavesh", email: "bhavesh@example.com", password: "correct-horse" });
    betaOwner = beta.id;
    betaBusiness = store.createBusiness(betaOwner, businessInput("Beta Mobiles", "beta-mobiles")).id;
    store.createDevice(betaOwner, betaBusiness, deviceInput({ inventoryReference: "BM-0001" }));
  });

  it("refuses every private operation on another retailer's business", () => {
    const attempts: (() => unknown)[] = [
      () => store.listDevices(betaOwner, alphaBusiness),
      () => store.getDevice(betaOwner, alphaBusiness, alphaDevice),
      () => store.createDevice(betaOwner, alphaBusiness, deviceInput({ inventoryReference: "X-1" })),
      () => store.updateDevice(betaOwner, alphaBusiness, alphaDevice, deviceInput({ inventoryReference: "X-2" })),
      () => store.setAvailability(betaOwner, alphaBusiness, alphaDevice, "sold"),
      () => store.setPriceVisibility(betaOwner, alphaBusiness, alphaDevice, false),
      () => store.deleteDevice(betaOwner, alphaBusiness, alphaDevice),
      () => store.suggestReference(betaOwner, alphaBusiness),
      () => store.listActivity(betaOwner, alphaBusiness, 10),
      () => store.getAnalytics(betaOwner, alphaBusiness, 7),
      () => store.completeOnboarding(betaOwner, alphaBusiness),
      () => store.updateStorefront(betaOwner, alphaBusiness, storefrontInput(businessInput("Hijacked", "hijacked"))),
      () =>
        store.saveImage(betaOwner, alphaBusiness, {
          bytes: Uint8Array.from([1, 2, 3]),
          contentType: "image/png",
        }),
    ];
    for (const attempt of attempts) {
      expect(attempt).toThrow(/don't have access/);
    }
  });

  it("cannot reach another retailer's device through its own business", () => {
    expect(store.getDevice(betaOwner, betaBusiness, alphaDevice)).toBeNull();
    expect(() => store.setAvailability(betaOwner, betaBusiness, alphaDevice, "sold")).toThrow(/no longer in your inventory/);
    expect(() => store.deleteDevice(betaOwner, betaBusiness, alphaDevice)).toThrow(/no longer in your inventory/);
    expect(() =>
      store.updateDevice(betaOwner, betaBusiness, alphaDevice, deviceInput({ inventoryReference: "BM-0009" })),
    ).toThrow(/no longer in your inventory/);
  });

  it("cannot attach another retailer's uploads to its own devices", () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]);
    const foreign = store.saveImage(alphaOwner, alphaBusiness, { bytes: png, contentType: "image/png" });
    expect(() =>
      store.createDevice(
        betaOwner,
        betaBusiness,
        deviceInput({ inventoryReference: "BM-0002", images: [{ url: foreign.url, isPrimary: true }] }),
      ),
    ).toThrow(/could not be attached/);
  });

  it("leaves the other retailer's data untouched after the attempts", () => {
    const device = store.getDevice(alphaOwner, alphaBusiness, alphaDevice);
    expect(device).not.toBeNull();
    expect(device?.availabilityStatus).not.toBe("sold");
    expect(store.getPublicShop("alpha-phones")?.name).toBe("Alpha Phones");
    expect(store.getPublicShop("hijacked")).toBeNull();
    expect(store.listDevices(betaOwner, betaBusiness)).toHaveLength(1);
  });

  it("persists everything to disk", () => {
    const file = path.join(directory, "db.json");
    const onDisk = JSON.parse(fs.readFileSync(file, "utf8"));
    expect(onDisk.businesses.some((business: { slug: string }) => business.slug === "beta-mobiles")).toBe(true);
    expect(onDisk.users.every((user: { passwordHash: string }) => user.passwordHash.startsWith("scrypt$"))).toBe(true);
    expect(JSON.stringify(onDisk)).not.toContain("correct-horse");
  });
});
