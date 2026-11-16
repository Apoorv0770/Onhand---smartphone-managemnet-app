import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import type { Account, Phone, ShopDetails } from "./data";
import type { Layout } from "./state";

/* ---------------------------------------------------------------------------
   The app, as a retailer or a customer uses it.

   Locators go by role and accessible name. The app keeps recently visited
   pages mounted but hidden (Cache Components), and renders some parts twice,
   once per layout. Role queries skip everything that is not actually shown,
   so each of them finds the one control a person could use.
--------------------------------------------------------------------------- */

/** "iPhone 14 Pro · 256 GB · Deep Purple", the way the dashboard names a phone. */
export function phoneLabel(phone: Phone): string {
  return `${phone.title} · ${phone.storage} · ${phone.colour}`;
}

/** A toast message, found by its title. */
export function toast(page: Page, title: string): Locator {
  return page.getByRole("region", { name: /Notifications/ }).getByRole("listitem").filter({ hasText: title });
}

/* --------------------------------- Account -------------------------------- */

export async function signUp(page: Page, account: Account): Promise<void> {
  await page.goto("/signup");
  await page.getByRole("textbox", { name: "Your name" }).fill(account.name);
  await page.getByRole("textbox", { name: "Email" }).fill(account.email);
  // A password field has no ARIA role, so it is found by its label instead.
  await page.getByLabel("Password", { exact: true }).filter({ visible: true }).fill(account.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
}

/* -------------------------------- Onboarding ------------------------------ */

/** Step 1 of onboarding. Ends on the "choose your link" step. */
export async function describeShop(page: Page, owner: Account, shop: ShopDetails): Promise<void> {
  await expect(
    page.getByRole("heading", { level: 1, name: `Welcome, ${owner.firstName}. Tell us about your shop.` }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Shop name" }).fill(shop.name);
  await page.getByRole("textbox", { name: "Area and city" }).fill(shop.location);
  await page.getByRole("textbox", { name: "WhatsApp number" }).fill(shop.whatsappLocal);
  await page.getByRole("textbox", { name: "Short description" }).fill(shop.description);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Choose your storefront link" })).toBeVisible();
}

export function addressField(page: Page): Locator {
  return page.getByRole("textbox", { name: "Storefront address" });
}

/** Step 2 of onboarding. Ends on the "first phone" step, with the shop created. */
export async function claimAddress(page: Page, slug: string): Promise<void> {
  await addressField(page).fill(slug);
  // The live availability check reports through the field's description.
  await expect(addressField(page)).toHaveAccessibleDescription("Available");
  await page.getByRole("button", { name: "Create my storefront" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Add your first phone" })).toBeVisible();
}

/** Steps 4 and 5 of onboarding: look at the preview, then go to the dashboard. */
export async function finishOnboarding(page: Page, shop: ShopDetails): Promise<void> {
  await expect(page.getByRole("heading", { level: 1, name: "This is what customers will see" })).toBeVisible();
  const preview = page.getByTitle(`Preview of ${shop.name}'s storefront`).contentFrame();
  await expect(preview.getByRole("heading", { level: 1, name: shop.name })).toBeVisible();
  await page.getByRole("button", { name: "Looks good, continue" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Your storefront is ready to share" })).toBeVisible();
  await expect(page.getByText(`/shop/${shop.slug}`, { exact: true }).filter({ visible: true })).toBeVisible();
  await page.getByRole("button", { name: "Go to my dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
}

/* -------------------------------- Device forms ---------------------------- */

/**
 * Types into a field that offers suggestions, then moves focus away so the
 * suggestion list closes and cannot cover the control below it.
 */
async function typeInto(field: Locator, value: string): Promise<void> {
  await field.fill(value);
  await field.blur();
  await expect(field).toHaveValue(value);
}

async function fillCommonPhoneFields(page: Page, phone: Phone): Promise<void> {
  await typeInto(page.getByRole("combobox", { name: "Brand" }), phone.brand);
  await typeInto(page.getByRole("combobox", { name: "Model" }), phone.model);
  const storage = page.getByRole("group", { name: "Storage" });
  await storage.getByRole("button", { name: phone.storage, exact: true }).click();
  await expect(storage.getByRole("button", { name: phone.storage, exact: true, pressed: true })).toBeVisible();
  await typeInto(page.getByRole("combobox", { name: "Colour" }), phone.colour);
  if (phone.batteryHealth !== null) {
    await page.getByRole("textbox", { name: "Battery health" }).fill(String(phone.batteryHealth));
  }
  const price = page.getByRole("textbox", { name: "Asking price" });
  await price.fill(String(phone.price));
  // The field regroups the digits the Indian way as they are typed.
  await expect(price).toHaveValue(phone.priceLabel.replace("₹", ""));
  await expect(page.getByRole("switch", { name: "Show price on storefront" })).toBeChecked();
}

/** The full device form in the dashboard. Returns the reference the app suggested. */
export async function fillDeviceForm(page: Page, phone: Phone, options: { notes?: string } = {}): Promise<string> {
  await expect(page.getByRole("heading", { level: 1, name: "Add a device" })).toBeVisible();
  await fillCommonPhoneFields(page, phone);
  const condition = page
    .getByRole("radiogroup", { name: "Overall condition" })
    .getByRole("radio", { name: new RegExp(`^${phone.condition}`) });
  await condition.click();
  await expect(condition).toBeChecked();
  if (options.notes) await page.getByRole("textbox", { name: "Internal notes" }).fill(options.notes);

  const reference = await page.getByRole("textbox", { name: "Inventory reference" }).inputValue();
  expect(reference, "the app suggests an inventory reference").toMatch(/^[A-Z0-9]+-\d{4}$/);
  return reference;
}

/** The short "first phone" form in onboarding. Ends on the preview step. */
export async function addFirstPhone(page: Page, phone: Phone): Promise<void> {
  await fillCommonPhoneFields(page, phone);
  const condition = page.getByRole("group", { name: "Condition" }).getByRole("button", { name: phone.condition });
  await condition.click();
  await expect(condition).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Add this phone" }).click();
  await expect(toast(page, "Your first phone is listed")).toBeVisible();
}

/* -------------------------------- Inventory ------------------------------- */

/** One phone in the inventory: a table row on wide screens, a card on phones. */
export function inventoryEntry(page: Page, layout: Layout, phone: Phone): Locator {
  return page
    .getByRole(layout === "desktop" ? "row" : "listitem")
    .filter({ has: page.getByRole("link", { name: phone.title }) });
}

export async function openInventory(page: Page): Promise<void> {
  await page.goto("/dashboard/inventory");
  await expect(page.getByRole("heading", { level: 1, name: "Inventory" })).toBeVisible();
}

/** Opens the "more actions" menu of one phone and picks an item. */
export async function chooseFromPhoneMenu(entry: Locator, item: string): Promise<void> {
  await entry.getByRole("button", { name: /^More actions for/ }).click();
  await entry.page().getByRole("menuitem", { name: item }).click();
}

/* -------------------------------- Storefront ------------------------------ */

export async function openStorefront(page: Page, slug: string, query = ""): Promise<void> {
  await page.goto(`/shop/${slug}${query}`);
  await expect(page.getByRole("heading", { level: 2, name: "Phones in stock" })).toBeVisible();
}

/** The list of phones on a storefront. */
export function catalog(page: Page): Locator {
  return page.getByRole("region", { name: "Results" });
}

/** One phone's card in the catalog. */
export function catalogCard(page: Page, phone: Phone): Locator {
  return catalog(page)
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { level: 3, name: phone.model, exact: true }) });
}

/** Asserts that the catalog lists exactly these phones, in any order. */
export async function expectCatalog(page: Page, phones: readonly Phone[]): Promise<void> {
  const expected = phones.map((phone) => phone.model).sort();
  await expect
    .poll(async () => (await catalog(page).getByRole("listitem").getByRole("heading", { level: 3 }).allTextContents()).sort(), {
      message: "phones listed in the catalog",
    })
    .toEqual(expected);
}

/**
 * Where a customer finds the filters: a sidebar on wide screens, a bottom
 * drawer behind the "Filters" button on phones.
 */
export async function openFilters(page: Page, layout: Layout): Promise<Locator> {
  if (layout === "desktop") return page.getByRole("complementary", { name: "Filters" });
  await page.getByRole("button", { name: /^Filters/ }).click();
  const drawer = page.getByRole("dialog", { name: "Filters" });
  await expect(drawer).toBeVisible();
  return drawer;
}

/** On phones, closes the filter drawer with its "Show N phones" button. */
export async function closeFilters(page: Page, layout: Layout, matching: number): Promise<void> {
  if (layout === "desktop") return;
  const drawer = page.getByRole("dialog", { name: "Filters" });
  await drawer.getByRole("button", { name: `Show ${matching} ${matching === 1 ? "phone" : "phones"}` }).click();
  await expect(drawer).toBeHidden();
}

/* -------------------------------- Public API ------------------------------ */

export interface PublicCatalog {
  shop: { name: string; slug: string; whatsappNumber: string; isDemo: boolean };
  devices: {
    id: string;
    reference: string;
    brand: string;
    model: string;
    storageGb: number;
    colour: string;
    availability: "available" | "reserved" | "sold";
    price: number | null;
  }[];
}

/** The public JSON for a storefront, as any visitor may fetch it. */
export async function fetchCatalog(request: APIRequestContext, slug: string): Promise<{ raw: string; data: PublicCatalog }> {
  const response = await request.get(`/api/public/shops/${slug}`);
  expect(response.status(), `GET /api/public/shops/${slug}`).toBe(200);
  const raw = await response.text();
  return { raw, data: JSON.parse(raw) as PublicCatalog };
}
