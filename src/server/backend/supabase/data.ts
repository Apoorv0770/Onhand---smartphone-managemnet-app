import "server-only";
import { randomUUID } from "node:crypto";
import { nextReference, referencePrefix } from "@/lib/device";
import { RESERVED_SLUGS } from "@/lib/schemas";
import type {
  Activity,
  Analytics,
  Business,
  Device,
  DeviceImageInput,
  PublicDevice,
  PublicShop,
  User,
} from "@/lib/types";
import { AppError } from "@/server/errors";
import type { Backend, UploadedImage } from "../types";

/* ---------------------------------------------------------------------------
   Supabase data layer.

   Every call is one RPC to a function defined in supabase/migrations. Private
   calls run as the signed-in user, so Row Level Security decides what they can
   touch; the SQL functions themselves are SECURITY INVOKER. Public storefront
   calls go through four SECURITY DEFINER functions that return public fields
   only.

   This module knows nothing about Next.js or cookies. It is handed an RPC
   client and a storage adapter, which is what lets the test suite run it
   against a real Postgres (PGlite) with the real migration and policies.
--------------------------------------------------------------------------- */

export interface RpcError {
  code?: string | null;
  message: string;
  details?: string | null;
  hint?: string | null;
}

export interface RpcResult {
  data: unknown;
  error: RpcError | null;
}

/** The slice of a Supabase client this layer needs. */
export interface RpcClient {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<RpcResult>;
}

export interface ImageStorage {
  /** Public URL of the bucket root, ending in "/". Object paths are appended. */
  publicBase: string;
  upload(path: string, image: UploadedImage): Promise<void>;
  remove(paths: string[]): Promise<void>;
}

export interface SupabaseDataDeps {
  /** Client carrying the signed-in user's session. */
  user: () => RpcClient | Promise<RpcClient>;
  /** Stateless client for storefront visitors. */
  anon: () => RpcClient | Promise<RpcClient>;
  storage: () => ImageStorage | Promise<ImageStorage>;
}

/** Calls about the signed-in account itself. Used by the auth layer. */
export interface SupabaseAccount {
  getProfile(): Promise<User | null>;
  updateProfile(name: string): Promise<User>;
  /** The signed-in user's profile and business in a single round trip. */
  getContext(): Promise<{ profile: User | null; business: Business | null }>;
}

export type SupabaseData = Omit<Backend, "mode" | "auth"> & { account: SupabaseAccount };

/* ------------------------------ Row shapes -------------------------------- */

// The database stores object paths, not URLs. Everything else already matches
// the app's types because the SQL functions emit them in that shape.

type BusinessRow = Omit<Business, "logoUrl" | "bannerUrl"> & {
  logoPath: string | null;
  bannerPath: string | null;
};

type DeviceRow = Omit<Device, "images"> & {
  images: { id: string; path: string; sortOrder: number; isPrimary: boolean }[];
};

type PublicShopRow = Omit<PublicShop, "logoUrl" | "bannerUrl"> & {
  logoPath: string | null;
  bannerPath: string | null;
};

type PublicDeviceRow = Omit<PublicDevice, "images"> & {
  images: { path: string; isPrimary: boolean }[];
};

const EXTENSIONS: Record<UploadedImage["contentType"], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const FILE_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Device ids arrive from URLs and from the browser. Postgres answers anything
 * that is not a uuid with a syntax error, which would surface as "something
 * went wrong". Such an id cannot name a device, so it is treated the way the
 * demo driver treats any id it does not know: the device is not there.
 */
function isDeviceId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/* --------------------------------- Errors --------------------------------- */

const MESSAGE = {
  signIn: "Please sign in again.",
  forbidden: "You don't have access to this business.",
  deviceGone: "That device is no longer in your inventory.",
  accountGone: "Account not found.",
  hasBusiness: "Your account already has a storefront.",
  slugTaken: "That storefront address is already taken.",
  referenceTaken: "Another device already uses this reference.",
  photoRejected: "One of the photos could not be attached. Please upload it again.",
  tooManyPhotos: "You can add up to 8 photos.",
  imageRejected: "That image could not be used. Please upload it again.",
} as const;

function photoRejected(): AppError {
  return new AppError("validation", MESSAGE.photoRejected, { images: MESSAGE.photoRejected });
}

function requireDeviceId(deviceId: unknown): void {
  if (!isDeviceId(deviceId)) throw new AppError("not_found", MESSAGE.deviceGone);
}

function imageRejected(field: "logoUrl" | "bannerUrl"): AppError {
  return new AppError("validation", MESSAGE.imageRejected, { [field]: MESSAGE.imageRejected });
}

/**
 * Turns a database error into the same user-facing error the demo driver
 * raises. The SQL functions signal expected failures as "onhand:<code>";
 * constraint and permission errors are mapped as a second line of defence.
 */
export function toAppError(error: RpcError, operation: string): Error {
  const text = `${error.message ?? ""} ${error.details ?? ""}`;
  const token = /onhand:([a-z_]+)/.exec(text)?.[1];

  switch (token) {
    case "unauthenticated":
      return new AppError("unauthenticated", MESSAGE.signIn);
    case "forbidden":
      return new AppError("forbidden", MESSAGE.forbidden);
    case "device_not_found":
      return new AppError("not_found", MESSAGE.deviceGone);
    case "account_not_found":
      return new AppError("not_found", MESSAGE.accountGone);
    case "already_has_business":
      return new AppError("conflict", MESSAGE.hasBusiness);
    case "slug_taken":
      return new AppError("conflict", MESSAGE.slugTaken, { slug: MESSAGE.slugTaken });
    case "reference_taken":
      return new AppError("conflict", MESSAGE.referenceTaken, { inventoryReference: MESSAGE.referenceTaken });
    case "image_not_owned":
      return photoRejected();
    case "too_many_images":
      return new AppError("validation", MESSAGE.tooManyPhotos, { images: MESSAGE.tooManyPhotos });
    case "logo_not_owned":
      return imageRejected("logoUrl");
    case "banner_not_owned":
      return imageRejected("bannerUrl");
  }

  const code = error.code ?? "";
  if (code === "23505") {
    if (text.includes("businesses_slug_key")) {
      return new AppError("conflict", MESSAGE.slugTaken, { slug: MESSAGE.slugTaken });
    }
    if (text.includes("businesses_owner_id_key")) return new AppError("conflict", MESSAGE.hasBusiness);
    if (text.includes("devices_business_reference_key")) {
      return new AppError("conflict", MESSAGE.referenceTaken, { inventoryReference: MESSAGE.referenceTaken });
    }
  }
  if (code === "23514") {
    if (text.includes("businesses_slug")) {
      return new AppError("conflict", MESSAGE.slugTaken, { slug: MESSAGE.slugTaken });
    }
    if (text.includes("device_images_path_owned")) return photoRejected();
    if (text.includes("businesses_logo_path_owned")) return imageRejected("logoUrl");
    if (text.includes("businesses_banner_path_owned")) return imageRejected("bannerUrl");
  }
  // Insufficient privilege: Row Level Security or a missing grant said no.
  if (code === "42501") return new AppError("forbidden", MESSAGE.forbidden);
  // PostgREST rejected the access token (expired or invalid).
  if (/^PGRST30\d$/.test(code)) return new AppError("unauthenticated", MESSAGE.signIn);

  const failure = new Error(`Supabase ${operation} failed: ${error.message}`);
  failure.name = "SupabaseError";
  return failure;
}

/* -------------------------------- Factory --------------------------------- */

export function createSupabaseData(deps: SupabaseDataDeps): SupabaseData {
  async function callAs<T>(who: "user" | "anon", fn: string, args?: Record<string, unknown>): Promise<T> {
    const client = await (who === "user" ? deps.user() : deps.anon());
    const { data, error } = await client.rpc(fn, args);
    if (error) throw toAppError(error, fn);
    return data as T;
  }

  const asUser = <T>(fn: string, args?: Record<string, unknown>) => callAs<T>("user", fn, args);
  const asVisitor = <T>(fn: string, args?: Record<string, unknown>) => callAs<T>("anon", fn, args);

  async function publicBase(): Promise<string> {
    return (await deps.storage()).publicBase;
  }

  function urlFor(base: string, path: string | null): string | null {
    return path ? `${base}${path}` : null;
  }

  /** Object path for a URL, or null unless it is one of this business's own uploads. */
  function pathFor(base: string, businessId: string, url: string): string | null {
    const prefix = `${base}${businessId}/`;
    if (!url.startsWith(prefix)) return null;
    const file = url.slice(prefix.length);
    return FILE_NAME.test(file) ? `${businessId}/${file}` : null;
  }

  function toBusiness(base: string, row: BusinessRow): Business {
    const { logoPath, bannerPath, ...rest } = row;
    return { ...rest, logoUrl: urlFor(base, logoPath), bannerUrl: urlFor(base, bannerPath) };
  }

  function toDevice(base: string, row: DeviceRow): Device {
    return {
      ...row,
      images: row.images.map((image) => ({
        id: image.id,
        url: `${base}${image.path}`,
        sortOrder: image.sortOrder,
        isPrimary: image.isPrimary,
      })),
    };
  }

  function toPublicShop(base: string, row: PublicShopRow): PublicShop {
    const { logoPath, bannerPath, ...rest } = row;
    return { ...rest, logoUrl: urlFor(base, logoPath), bannerUrl: urlFor(base, bannerPath) };
  }

  function toPublicDevice(base: string, row: PublicDeviceRow): PublicDevice {
    return {
      ...row,
      images: row.images.map((image) => ({ url: `${base}${image.path}`, isPrimary: image.isPrimary })),
    };
  }

  function imagePaths(base: string, businessId: string, images: DeviceImageInput[]) {
    return images.map((image) => {
      const path = pathFor(base, businessId, image.url);
      if (!path) throw photoRejected();
      return { path, isPrimary: image.isPrimary };
    });
  }

  /** Storage cleanup never fails a request: a leftover file is harmless. */
  async function removeFiles(paths: string[] | null | undefined): Promise<void> {
    if (!paths?.length) return;
    try {
      await (await deps.storage()).remove(paths);
    } catch {
      // Ignored on purpose.
    }
  }

  return {
    /* ------------------------------- Account ------------------------------ */

    account: {
      async getProfile() {
        return asUser<User | null>("get_my_profile");
      },

      async updateProfile(name) {
        return asUser<User>("update_my_profile", { p_name: name });
      },

      async getContext() {
        const row = await asUser<{ profile: User | null; business: BusinessRow | null } | null>("get_my_context");
        const business = row?.business ? toBusiness(await publicBase(), row.business) : null;
        return { profile: row?.profile ?? null, business };
      },
    },

    /* ------------------------------- Business ----------------------------- */

    async getBusinessForUser() {
      const row = await asUser<BusinessRow | null>("get_my_business");
      return row ? toBusiness(await publicBase(), row) : null;
    },

    async createBusiness(_userId, input) {
      if (RESERVED_SLUGS.has(input.slug)) {
        throw new AppError("conflict", MESSAGE.slugTaken, { slug: MESSAGE.slugTaken });
      }
      const row = await asUser<BusinessRow>("create_business", {
        p_input: {
          name: input.name,
          slug: input.slug,
          description: input.description,
          location: input.location,
          whatsappNumber: input.whatsappNumber,
          phoneNumber: input.phoneNumber,
          instagramHandle: input.instagramHandle,
        },
      });
      return toBusiness(await publicBase(), row);
    },

    async updateStorefront(_userId, businessId, input) {
      const base = await publicBase();
      const logoPath = input.logoUrl ? pathFor(base, businessId, input.logoUrl) : null;
      const bannerPath = input.bannerUrl ? pathFor(base, businessId, input.bannerUrl) : null;
      if (input.logoUrl && !logoPath) throw imageRejected("logoUrl");
      if (input.bannerUrl && !bannerPath) throw imageRejected("bannerUrl");

      const result = await asUser<{ business: BusinessRow; stalePaths: string[] }>("update_storefront", {
        p_business_id: businessId,
        p_input: {
          name: input.name,
          slug: input.slug,
          description: input.description,
          location: input.location,
          whatsappNumber: input.whatsappNumber,
          phoneNumber: input.phoneNumber,
          instagramHandle: input.instagramHandle,
          logoPath,
          bannerPath,
          coverStyle: input.coverStyle,
          hours: input.hours,
          showPricesByDefault: input.showPricesByDefault,
          showSoldDevices: input.showSoldDevices,
        },
      });
      await removeFiles(result.stalePaths);
      return toBusiness(base, result.business);
    },

    async completeOnboarding(_userId, businessId) {
      const row = await asUser<BusinessRow>("complete_onboarding", { p_business_id: businessId });
      return toBusiness(await publicBase(), row);
    },

    async isSlugAvailable(slug, exceptBusinessId) {
      if (RESERVED_SLUGS.has(slug)) return false;
      return asUser<boolean>("is_slug_available", {
        p_slug: slug,
        p_except_business_id: exceptBusinessId ?? null,
      });
    },

    /* -------------------------------- Devices ----------------------------- */

    async listDevices(_userId, businessId) {
      const rows = await asUser<DeviceRow[]>("list_devices", { p_business_id: businessId });
      const base = await publicBase();
      return rows.map((row) => toDevice(base, row));
    },

    async getDevice(_userId, businessId, deviceId) {
      if (!isDeviceId(deviceId)) return null;
      const row = await asUser<DeviceRow | null>("get_device", {
        p_business_id: businessId,
        p_device_id: deviceId,
      });
      return row ? toDevice(await publicBase(), row) : null;
    },

    async createDevice(_userId, businessId, input) {
      const base = await publicBase();
      const row = await asUser<DeviceRow>("create_device", {
        p_business_id: businessId,
        p_input: { ...input, images: imagePaths(base, businessId, input.images) },
      });
      return toDevice(base, row);
    },

    async updateDevice(_userId, businessId, deviceId, input) {
      requireDeviceId(deviceId);
      const base = await publicBase();
      const result = await asUser<{ device: DeviceRow; removedPaths: string[] }>("update_device", {
        p_business_id: businessId,
        p_device_id: deviceId,
        p_input: { ...input, images: imagePaths(base, businessId, input.images) },
      });
      await removeFiles(result.removedPaths);
      return toDevice(base, result.device);
    },

    async setAvailability(_userId, businessId, deviceId, status) {
      requireDeviceId(deviceId);
      const row = await asUser<DeviceRow>("set_device_availability", {
        p_business_id: businessId,
        p_device_id: deviceId,
        p_status: status,
      });
      return toDevice(await publicBase(), row);
    },

    async setPriceVisibility(_userId, businessId, deviceId, showPrice) {
      requireDeviceId(deviceId);
      const row = await asUser<DeviceRow>("set_device_price_visibility", {
        p_business_id: businessId,
        p_device_id: deviceId,
        p_show_price: showPrice,
      });
      return toDevice(await publicBase(), row);
    },

    async deleteDevice(_userId, businessId, deviceId) {
      requireDeviceId(deviceId);
      const result = await asUser<{ removedPaths: string[] }>("delete_device", {
        p_business_id: businessId,
        p_device_id: deviceId,
      });
      await removeFiles(result.removedPaths);
    },

    async suggestReference(_userId, businessId) {
      const context = await asUser<{ name: string; references: string[] } | null>("get_reference_context", {
        p_business_id: businessId,
      });
      if (!context) throw new AppError("forbidden", MESSAGE.forbidden);
      return nextReference(referencePrefix(context.name), context.references);
    },

    /* --------------------------------- Media ------------------------------ */

    async saveImage(_userId, businessId, image) {
      const extension = EXTENSIONS[image.contentType];
      if (!extension) throw new AppError("validation", "Use a JPG, PNG or WebP image.");
      const storage = await deps.storage();
      const path = `${businessId}/${randomUUID()}.${extension}`;
      // The bucket's policy only accepts paths inside a business the user manages.
      await storage.upload(path, image);
      return { url: `${storage.publicBase}${path}` };
    },

    /* ------------------------- Activity and analytics --------------------- */

    async listActivity(_userId, businessId, limit) {
      return asUser<Activity[]>("list_activity", { p_business_id: businessId, p_limit: limit });
    },

    async getAnalytics(_userId, businessId, days) {
      return asUser<Analytics>("get_analytics", { p_business_id: businessId, p_days: days });
    },

    async recordEvent(slug, type, deviceShortId) {
      try {
        const client = await deps.anon();
        await client.rpc("record_storefront_event", {
          p_slug: slug,
          p_type: type,
          p_device_short_id: deviceShortId ?? null,
        });
      } catch {
        // Analytics must never break a storefront page.
      }
    },

    /* -------------------------------- Public ------------------------------ */

    async getPublicShop(slug) {
      const row = await asVisitor<PublicShopRow | null>("get_public_shop", { p_slug: slug });
      return row ? toPublicShop(await publicBase(), row) : null;
    },

    async listPublicDevices(slug) {
      const rows = await asVisitor<PublicDeviceRow[] | null>("list_public_devices", { p_slug: slug });
      const base = await publicBase();
      return (rows ?? []).map((row) => toPublicDevice(base, row));
    },

    async getPublicDevice(slug, shortId) {
      const row = await asVisitor<PublicDeviceRow | null>("get_public_device", {
        p_slug: slug,
        p_short_id: shortId,
      });
      return row ? toPublicDevice(await publicBase(), row) : null;
    },
  };
}
