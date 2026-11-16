import { randomBytes, randomInt } from "node:crypto";

/* ---------------------------------------------------------------------------
   Test data. Accounts, shops and phone numbers are generated for each run, so
   no real credentials or contact details live in the repository.
--------------------------------------------------------------------------- */

/** One of the fictional demo shops that every fresh demo database starts with. */
export const DEMO_SHOP_SLUG = "urban-mobile-studio";

/** Short random token that is safe in an email address and a storefront address. */
export function token(length = 6): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length }, () => alphabet[randomInt(alphabet.length)]).join("");
}

export interface Account {
  name: string;
  firstName: string;
  email: string;
  password: string;
}

export function newAccount(firstName: string, lastName: string): Account {
  return {
    name: `${firstName} ${lastName}`,
    firstName,
    // ".example" is reserved for documentation and can never be a real mailbox.
    email: `${firstName.toLowerCase()}.${token()}@e2e.onhand.example`,
    password: randomBytes(12).toString("base64url"),
  };
}

export interface ShopDetails {
  name: string;
  /** The address onboarding suggests for this name. */
  suggestedSlug: string;
  /** The address the retailer actually chooses. */
  slug: string;
  location: string;
  description: string;
  /** Ten digits, as a retailer types them into the "+91" field. */
  whatsappLocal: string;
  /** The same number as the app stores it and as wa.me expects it. */
  whatsappInternational: string;
}

export function newShopDetails(firstWord: string, location: string): ShopDetails {
  const id = token();
  const whatsappLocal = `9${String(randomInt(10 ** 9)).padStart(9, "0")}`;
  return {
    name: `${firstWord} Mobile Hub ${id}`,
    suggestedSlug: `${firstWord.toLowerCase()}-mobile-hub-${id}`,
    slug: `${firstWord.toLowerCase()}-${id}`,
    location,
    description: "Hand-checked pre-owned phones. Created by the end-to-end tests.",
    whatsappLocal,
    whatsappInternational: `91${whatsappLocal}`,
  };
}

export type Condition = "Like new" | "Excellent" | "Good" | "Fair";

export interface Phone {
  brand: string;
  /** What the retailer types into "Model", and the heading on a catalog card. */
  model: string;
  /** How the app names the phone in sentences: the brand is added unless the model already reads as a full name. */
  title: string;
  storageGb: number;
  storage: string;
  colour: string;
  condition: Condition;
  batteryHealth: number | null;
  price: number;
  /** The price as the app prints it, in Indian digit grouping. */
  priceLabel: string;
}

/**
 * The three phones the first retailer lists. Each later scenario leans on one
 * of them, so scenarios that change a phone never disturb the others:
 *
 *   iphone  stays available with a public price   (inquiry link, tenant isolation)
 *   pixel   is marked sold                        (scenarios 7 and 8)
 *   fold    has its price hidden                  (scenarios 9 and 10)
 *
 * Between them they give every catalog filter something to tell apart: three
 * brands, and two storage sizes split two against one.
 */
export const PHONES = {
  iphone: {
    brand: "Apple",
    model: "iPhone 14 Pro",
    title: "iPhone 14 Pro",
    storageGb: 256,
    storage: "256 GB",
    colour: "Deep Purple",
    condition: "Excellent",
    batteryHealth: 91,
    price: 54500,
    priceLabel: "₹54,500",
  },
  fold: {
    brand: "Samsung",
    model: "Galaxy Z Fold 5",
    title: "Samsung Galaxy Z Fold 5",
    storageGb: 256,
    storage: "256 GB",
    colour: "Phantom Black",
    condition: "Good",
    batteryHealth: null,
    // Six digits on purpose: a number this long cannot turn up by chance in a
    // timestamp or a file hash when scenario 10 searches whole responses for it.
    price: 118750,
    priceLabel: "₹1,18,750",
  },
  pixel: {
    brand: "Google",
    model: "Pixel 8",
    title: "Google Pixel 8",
    storageGb: 128,
    storage: "128 GB",
    colour: "Obsidian",
    condition: "Like new",
    batteryHealth: null,
    price: 41500,
    priceLabel: "₹41,500",
  },
} as const satisfies Record<string, Phone>;

export type PhoneKey = keyof typeof PHONES;

export const PHONE_KEYS = Object.keys(PHONES) as PhoneKey[];

/** The one phone the second retailer lists in scenario 12. */
export const RIVAL_PHONE: Phone = {
  brand: "OnePlus",
  model: "OnePlus 12",
  title: "OnePlus 12",
  storageGb: 512,
  storage: "512 GB",
  colour: "Silky Black",
  condition: "Good",
  batteryHealth: null,
  price: 46999,
  priceLabel: "₹46,999",
};
