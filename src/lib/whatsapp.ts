import { deviceTitle } from "@/lib/device";
import { formatStorage } from "@/lib/format";

interface InquiryDevice {
  brand: string;
  model: string;
  storageGb: number;
  colour: string;
  reference: string;
}

/**
 * The message a customer sends when asking about one specific device.
 * The reference lets the retailer find the exact unit in their inventory.
 */
export function buildInquiryMessage(device: InquiryDevice, pageUrl?: string): string {
  const description = [deviceTitle(device), formatStorage(device.storageGb), device.colour.trim()]
    .filter(Boolean)
    .join(", ");
  const lines = [
    `Hi, I found the ${description} on your catalog. Is this specific device still available?`,
    "",
    `Ref: ${device.reference}`,
  ];
  if (pageUrl) lines.push(pageUrl);
  return lines.join("\n");
}

export function buildGeneralMessage(shopName: string, pageUrl?: string): string {
  const lines = [`Hi ${shopName}, I was browsing your catalog and have a question.`];
  if (pageUrl) lines.push("", pageUrl);
  return lines.join("\n");
}

/** wa.me link. Without a number WhatsApp asks the sender to pick a chat. */
export function whatsappLink(number: string | null | undefined, message: string): string {
  const digits = (number ?? "").replace(/\D/g, "");
  const text = encodeURIComponent(message);
  return digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
}

/**
 * Normalises an Indian mobile number to "91XXXXXXXXXX".
 * Accepts "+91 98765 43210", "09876543210", "9876543210" and similar.
 */
export function normaliseIndianMobile(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  return `91${digits}`;
}

/** Extracts a clean handle from "@name", "instagram.com/name" or a full URL. */
export function normaliseInstagramHandle(input: string): string | null {
  let value = input.trim();
  if (!value) return null;
  value = value.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^(www\.)?instagram\.com\//i, "");
  value = value.replace(/^@/, "").split(/[/?#]/)[0];
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(value)) return null;
  return value.toLowerCase();
}

export function instagramUrl(handle: string): string {
  return `https://www.instagram.com/${handle}/`;
}
