import type {
  Activity,
  Analytics,
  AvailabilityStatus,
  Business,
  BusinessInput,
  Device,
  DeviceInput,
  PublicDevice,
  PublicShop,
  StorefrontEventType,
  StorefrontSettingsInput,
  User,
} from "@/lib/types";

export type BackendMode = "local" | "supabase";

export type AuthResult =
  | {
      ok: true;
      user: User;
      /**
       * True when the account exists but has no session yet because the email
       * address still has to be confirmed (Supabase with confirmations on).
       */
      pendingConfirmation?: boolean;
    }
  | { ok: false; error: string; field?: "email" | "password" };

export interface UploadedImage {
  bytes: Uint8Array;
  contentType: "image/jpeg" | "image/png" | "image/webp";
}

/**
 * Everything the app needs from a persistence layer.
 *
 * Two implementations exist: a local JSON-file driver (demo mode) and a
 * Supabase driver. Private methods take the acting user's id. The local driver
 * authorises against it directly; the Supabase driver relies on Row Level
 * Security with the user's own session, so the database enforces the same rule.
 */
export interface Backend {
  readonly mode: BackendMode;

  auth: {
    /** The signed-in user for the current request, or null. */
    getUser(): Promise<User | null>;
    signUp(input: { name: string; email: string; password: string }): Promise<AuthResult>;
    signIn(input: { email: string; password: string }): Promise<AuthResult>;
    signOut(): Promise<void>;
    /** Sends a reset email where the driver supports it. */
    requestPasswordReset(email: string, redirectTo: string): Promise<{ supported: boolean }>;
    /** Sets a new password for the current (recovery) session. */
    updatePassword(password: string): Promise<{ ok: true } | { ok: false; error: string }>;
    updateProfile(userId: string, input: { name: string }): Promise<User>;
  };

  /* Business */
  getBusinessForUser(userId: string): Promise<Business | null>;
  createBusiness(userId: string, input: BusinessInput): Promise<Business>;
  updateStorefront(userId: string, businessId: string, input: StorefrontSettingsInput): Promise<Business>;
  completeOnboarding(userId: string, businessId: string): Promise<Business>;
  isSlugAvailable(slug: string, exceptBusinessId?: string): Promise<boolean>;

  /* Devices (private) */
  listDevices(userId: string, businessId: string): Promise<Device[]>;
  getDevice(userId: string, businessId: string, deviceId: string): Promise<Device | null>;
  createDevice(userId: string, businessId: string, input: DeviceInput): Promise<Device>;
  updateDevice(userId: string, businessId: string, deviceId: string, input: DeviceInput): Promise<Device>;
  setAvailability(
    userId: string,
    businessId: string,
    deviceId: string,
    status: AvailabilityStatus,
  ): Promise<Device>;
  setPriceVisibility(userId: string, businessId: string, deviceId: string, showPrice: boolean): Promise<Device>;
  deleteDevice(userId: string, businessId: string, deviceId: string): Promise<void>;
  suggestReference(userId: string, businessId: string): Promise<string>;

  /* Media */
  saveImage(userId: string, businessId: string, image: UploadedImage): Promise<{ url: string }>;

  /* Activity and analytics */
  listActivity(userId: string, businessId: string, limit: number): Promise<Activity[]>;
  getAnalytics(userId: string, businessId: string, days: number): Promise<Analytics>;
  recordEvent(slug: string, type: StorefrontEventType, deviceShortId?: string | null): Promise<void>;

  /* Public storefront. No authentication, sanitised shapes only. */
  getPublicShop(slug: string): Promise<PublicShop | null>;
  listPublicDevices(slug: string): Promise<PublicDevice[]>;
  getPublicDevice(slug: string, shortId: string): Promise<PublicDevice | null>;
}
