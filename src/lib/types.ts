/* ---------------------------------------------------------------------------
   Domain model shared by server and client.
   Private shapes (Device, Business) never leave the server except through an
   authenticated dashboard route. Storefronts only ever receive Public* shapes.
--------------------------------------------------------------------------- */

export type AvailabilityStatus = "available" | "reserved" | "sold";
export type DeviceCondition = "like_new" | "excellent" | "good" | "fair";
export type MemberRole = "owner" | "staff";
export type CoverStyleId = "graphite" | "paper" | "ember" | "lagoon" | "moss" | "dusk";

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface DayHours {
  closed: boolean;
  /** 24h "HH:mm" in the shop's local time (India Standard Time). */
  open: string;
  close: string;
}

export type BusinessHours = Record<Weekday, DayHours>;

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface BusinessSettings {
  /** Default for the "show price publicly" toggle on new devices. */
  showPricesByDefault: boolean;
  /** Keep sold devices visible (marked as sold) on the storefront. */
  showSoldDevices: boolean;
  coverStyle: CoverStyleId;
  hours: BusinessHours | null;
  onboardingCompletedAt: string | null;
}

export interface Business {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  description: string;
  location: string;
  /** Digits only, with country code, no plus sign. Example: 919876543210 */
  whatsappNumber: string;
  phoneNumber: string | null;
  instagramHandle: string | null;
  settings: BusinessSettings;
  /** True only for the seeded fictional retailers. */
  isDemo: boolean;
  createdAt: string;
}

export interface DeviceImage {
  id: string;
  url: string;
  sortOrder: number;
  isPrimary: boolean;
}

export interface Device {
  id: string;
  /** Short public identifier used in storefront URLs. */
  shortId: string;
  businessId: string;
  inventoryReference: string;
  brand: string;
  model: string;
  storageGb: number;
  colour: string;
  batteryHealth: number | null;
  condition: DeviceCondition;
  cosmeticCondition: string;
  functionalCondition: string;
  accessories: string[];
  warranty: string;
  /** Internal only. Never exposed publicly. */
  notes: string;
  /** Asking price in whole rupees. Internal unless showPrice is true. */
  price: number | null;
  showPrice: boolean;
  availabilityStatus: AvailabilityStatus;
  images: DeviceImage[];
  createdAt: string;
  updatedAt: string;
  soldAt: string | null;
}

export type ActivityAction =
  | "business_created"
  | "storefront_updated"
  | "device_added"
  | "device_updated"
  | "device_sold"
  | "device_reserved"
  | "device_available"
  | "device_deleted"
  | "price_shown"
  | "price_hidden";

export interface Activity {
  id: string;
  businessId: string;
  deviceId: string | null;
  action: ActivityAction;
  /** Snapshot of what the entry refers to, so it survives device deletion. */
  subject: string;
  reference: string | null;
  performedBy: string;
  performedByName: string;
  timestamp: string;
}

export type StorefrontEventType = "view" | "inquiry";

export interface AnalyticsDay {
  /** YYYY-MM-DD in IST. */
  day: string;
  views: number;
  inquiries: number;
}

export interface Analytics {
  days: AnalyticsDay[];
  totalViews: number;
  totalInquiries: number;
  /** Inquiry taps per device short id within the window. */
  inquiriesByDevice: Record<string, number>;
}

/* ------------------------------- Public DTOs ------------------------------ */

export interface PublicShop {
  name: string;
  slug: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  description: string;
  location: string;
  whatsappNumber: string;
  phoneNumber: string | null;
  instagramHandle: string | null;
  coverStyle: CoverStyleId;
  hours: BusinessHours | null;
  isDemo: boolean;
}

export interface PublicDeviceImage {
  url: string;
  isPrimary: boolean;
}

export interface PublicDevice {
  /** Short public id. The internal database id is never exposed. */
  id: string;
  reference: string;
  brand: string;
  model: string;
  storageGb: number;
  colour: string;
  batteryHealth: number | null;
  condition: DeviceCondition;
  cosmeticCondition: string;
  functionalCondition: string;
  accessories: string[];
  warranty: string;
  availability: AvailabilityStatus;
  /** Null whenever the retailer has not made the price public. */
  price: number | null;
  images: PublicDeviceImage[];
  addedAt: string;
}

/* --------------------------------- Inputs --------------------------------- */

export interface DeviceImageInput {
  url: string;
  isPrimary: boolean;
}

export interface DeviceInput {
  brand: string;
  model: string;
  storageGb: number;
  colour: string;
  batteryHealth: number | null;
  condition: DeviceCondition;
  cosmeticCondition: string;
  functionalCondition: string;
  accessories: string[];
  warranty: string;
  notes: string;
  price: number | null;
  showPrice: boolean;
  availabilityStatus: AvailabilityStatus;
  inventoryReference: string;
  /** YYYY-MM-DD */
  addedOn: string;
  images: DeviceImageInput[];
}

export interface BusinessInput {
  name: string;
  slug: string;
  description: string;
  location: string;
  whatsappNumber: string;
  phoneNumber: string | null;
  instagramHandle: string | null;
}

export interface StorefrontSettingsInput extends BusinessInput {
  logoUrl: string | null;
  bannerUrl: string | null;
  coverStyle: CoverStyleId;
  hours: BusinessHours | null;
  showPricesByDefault: boolean;
  showSoldDevices: boolean;
}

/* --------------------------------- Results -------------------------------- */

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
