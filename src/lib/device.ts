import { formatStorage } from "@/lib/format";
import { slugify } from "@/lib/utils";

interface Named {
  brand: string;
  model: string;
}

interface Specced extends Named {
  storageGb: number;
  colour: string;
}

/**
 * Human title for a device. Apple models already read as a full name
 * ("iPhone 14 Pro"); most others need their brand ("Samsung Galaxy S23").
 */
export function deviceTitle({ brand, model }: Named): string {
  const cleanBrand = brand.trim();
  const cleanModel = model.trim();
  if (!cleanBrand) return cleanModel;
  if (!cleanModel) return cleanBrand;
  if (cleanBrand.toLowerCase() === "apple") return cleanModel;
  if (cleanModel.toLowerCase().startsWith(cleanBrand.toLowerCase())) return cleanModel;
  return `${cleanBrand} ${cleanModel}`;
}

/** "256 GB · Deep Purple" */
export function deviceSpecLine({ storageGb, colour }: Pick<Specced, "storageGb" | "colour">): string {
  return [storageGb ? formatStorage(storageGb) : "", colour.trim()].filter(Boolean).join(" · ");
}

/** "iPhone 14 Pro · 256 GB · Deep Purple" */
export function deviceLabel(device: Specced): string {
  return [deviceTitle(device), deviceSpecLine(device)].filter(Boolean).join(" · ");
}

/** URL segment for a public device page: readable words plus the short id. */
export function deviceSlug(device: Specced & { id: string }): string {
  const words = slugify(`${deviceTitle(device)} ${formatStorage(device.storageGb)} ${device.colour}`);
  return words ? `${words}-${device.id}` : device.id;
}

/** Extracts the short id from a device URL segment. */
export function shortIdFromSlug(slug: string): string {
  const decoded = decodeURIComponent(slug);
  const index = decoded.lastIndexOf("-");
  return index === -1 ? decoded : decoded.slice(index + 1);
}

export function devicePath(shopSlug: string, device: Specced & { id: string }): string {
  return `/shop/${shopSlug}/${deviceSlug(device)}`;
}

/** Three letter reference prefix from a business name: "Urban Mobile Studio" -> "UMS". */
export function referencePrefix(businessName: string): string {
  const words = businessName
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "INV";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase().padEnd(3, "X");
  return words
    .slice(0, 3)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

/** Next reference in a "UMS-0042" style sequence. */
export function nextReference(prefix: string, existing: string[]): string {
  const pattern = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d+)$`, "i");
  let highest = 0;
  for (const reference of existing) {
    const match = pattern.exec(reference.trim());
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return `${prefix}-${String(highest + 1).padStart(4, "0")}`;
}

export function batteryTone(health: number): "good" | "ok" | "low" {
  if (health >= 85) return "good";
  if (health >= 78) return "ok";
  return "low";
}
