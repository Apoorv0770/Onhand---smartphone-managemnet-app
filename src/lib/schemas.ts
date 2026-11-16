import { z } from "zod";
import { COVER_STYLE_IDS } from "@/lib/catalog";
import { normaliseIndianMobile, normaliseInstagramHandle } from "@/lib/whatsapp";

/* ---------------------------------------------------------------------------
   Validation shared by forms (client) and server actions (server).
   The server always re-validates. Client validation is only for fast feedback.
--------------------------------------------------------------------------- */

export const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "app",
  "dashboard",
  "demo",
  "help",
  "login",
  "new",
  "onboarding",
  "onhand",
  "settings",
  "shop",
  "signup",
  "support",
  "www",
]);

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Use at least 3 characters")
  .max(40, "Keep it under 40 characters")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens")
  .refine((value) => !RESERVED_SLUGS.has(value), "That address is reserved. Try another.");

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a valid time");

const dayHoursSchema = z.object({
  closed: z.boolean(),
  open: timeSchema,
  close: timeSchema,
});

export const hoursSchema = z.object({
  mon: dayHoursSchema,
  tue: dayHoursSchema,
  wed: dayHoursSchema,
  thu: dayHoursSchema,
  fri: dayHoursSchema,
  sat: dayHoursSchema,
  sun: dayHoursSchema,
});

const whatsappSchema = z
  .string()
  .trim()
  .min(1, "Enter your WhatsApp number")
  .refine((value) => normaliseIndianMobile(value) !== null, "Enter a valid 10-digit Indian mobile number");

const optionalPhoneSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || normaliseIndianMobile(value) !== null, "Enter a valid 10-digit number, or leave it empty");

const instagramSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || normaliseInstagramHandle(value) !== null,
    "Enter an Instagram username, for example urbanmobile",
  );

/** Form shape for business details. Phone fields are raw strings here. */
export const businessFormSchema = z.object({
  name: z.string().trim().min(2, "Enter your shop name").max(60, "Keep it under 60 characters"),
  slug: slugSchema,
  description: z.string().trim().max(240, "Keep it under 240 characters"),
  location: z.string().trim().min(2, "Enter your area and city").max(120, "Keep it under 120 characters"),
  whatsappNumber: whatsappSchema,
  phoneNumber: optionalPhoneSchema,
  instagramHandle: instagramSchema,
});

export type BusinessFormValues = z.infer<typeof businessFormSchema>;

export const storefrontFormSchema = businessFormSchema.extend({
  logoUrl: z.string().max(500).nullable(),
  bannerUrl: z.string().max(500).nullable(),
  coverStyle: z.enum(COVER_STYLE_IDS),
  hoursEnabled: z.boolean(),
  hours: hoursSchema,
  showPricesByDefault: z.boolean(),
  showSoldDevices: z.boolean(),
});

export type StorefrontFormValues = z.infer<typeof storefrontFormSchema>;

export const deviceImageSchema = z.object({
  url: z.string().min(1).max(500),
  isPrimary: z.boolean(),
});

export const deviceFormSchema = z.object({
  brand: z.string().trim().min(1, "Choose or type a brand").max(40, "Keep it under 40 characters"),
  model: z.string().trim().min(1, "Enter the model").max(60, "Keep it under 60 characters"),
  storageGb: z
    .number({ error: "Choose the storage" })
    .int("Use a whole number")
    .min(1, "Choose the storage")
    .max(4096, "That looks too large"),
  colour: z.string().trim().min(1, "Enter the colour").max(40, "Keep it under 40 characters"),
  condition: z.enum(["like_new", "excellent", "good", "fair"], { error: "Choose a condition" }),
  batteryHealth: z
    .number({ error: "Enter a number between 1 and 100" })
    .int("Use a whole number")
    .min(1, "Enter a number between 1 and 100")
    .max(100, "Enter a number between 1 and 100")
    .nullable(),
  cosmeticCondition: z.string().trim().max(200, "Keep it under 200 characters"),
  functionalCondition: z.string().trim().max(200, "Keep it under 200 characters"),
  accessories: z.array(z.string().trim().min(1).max(40)).max(12),
  warranty: z.string().trim().max(80, "Keep it under 80 characters"),
  notes: z.string().trim().max(1000, "Keep it under 1000 characters"),
  price: z
    .number({ error: "Enter a price in rupees" })
    .int("Use whole rupees")
    .min(0, "Price cannot be negative")
    .max(10_000_000, "That price looks too high")
    .nullable(),
  showPrice: z.boolean(),
  availabilityStatus: z.enum(["available", "reserved", "sold"]),
  inventoryReference: z
    .string()
    .trim()
    .min(1, "Enter a reference")
    .max(24, "Keep it under 24 characters")
    .regex(/^[A-Za-z0-9][A-Za-z0-9\-_/.]*$/, "Use letters, numbers and hyphens only"),
  addedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  images: z.array(deviceImageSchema).max(8, "You can add up to 8 photos"),
});

export type DeviceFormValues = z.infer<typeof deviceFormSchema>;

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Enter your email address")
  .max(120, "Keep it under 120 characters")
  .pipe(z.email("Enter a valid email address"));

export const signUpSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(60, "Keep it under 60 characters"),
  email: emailSchema,
  password: z.string().min(8, "Use at least 8 characters").max(72, "Keep it under 72 characters"),
});

export type SignUpValues = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
});

export type SignInValues = z.infer<typeof signInSchema>;

export const emailOnlySchema = z.object({
  email: emailSchema,
});

export const newPasswordSchema = z.object({
  password: z.string().min(8, "Use at least 8 characters").max(72, "Keep it under 72 characters"),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(60, "Keep it under 60 characters"),
});

/** First message per top-level field, for showing next to inputs. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? String(issue.path[0]) : "form";
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}
