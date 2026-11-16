import fs from "node:fs";
import path from "node:path";
import type { PhoneKey } from "./data";
import { stateDir } from "./run";

/* ---------------------------------------------------------------------------
   What scenarios 1 and 2 hand to every later scenario.

   The "onboarding" projects build one shop per viewport through the real UI
   and write down what only that run knows: the shop's address, its owner's
   signed-in session and the identifiers the app generated for each phone.
--------------------------------------------------------------------------- */

export type Layout = "desktop" | "mobile";

export interface ListedPhone {
  /** Internal database id. Only the owner's dashboard ever shows it. */
  id: string;
  /** Inventory reference the app suggested, for example "LMH-0002". */
  reference: string;
  /** Path of the phone's public page, as linked from the catalog. */
  path: string;
}

export interface ShopRecord {
  name: string;
  slug: string;
  location: string;
  /** Digits only with country code, the way wa.me links carry it. */
  whatsappNumber: string;
  ownerEmail: string;
  /** A marker typed into one phone's internal notes. It must never be public. */
  privateNote: string;
  phones: Record<PhoneKey, ListedPhone>;
}

/** Browser storage (the session cookie) of the retailer who owns the shop. */
export function sessionFile(layout: Layout): string {
  return path.join(stateDir(), `${layout}-session.json`);
}

function shopFile(layout: Layout): string {
  return path.join(stateDir(), `${layout}-shop.json`);
}

export function saveShop(layout: Layout, shop: ShopRecord): void {
  fs.mkdirSync(stateDir(), { recursive: true });
  fs.writeFileSync(shopFile(layout), JSON.stringify(shop, null, 2), "utf8");
}

export function loadShop(layout: Layout): ShopRecord {
  const file = shopFile(layout);
  if (!fs.existsSync(file)) {
    throw new Error(
      `No shop has been set up for the ${layout} viewport. Scenarios 1 and 2 (the "${layout}-onboarding" project) ` +
        "create it, so run the suite without --no-deps.",
    );
  }
  return JSON.parse(fs.readFileSync(file, "utf8")) as ShopRecord;
}
