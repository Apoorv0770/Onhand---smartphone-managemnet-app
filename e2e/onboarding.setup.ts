import {
  addressField,
  catalogCard,
  claimAddress,
  describeShop,
  expectCatalog,
  fetchCatalog,
  fillDeviceForm,
  finishOnboarding,
  inventoryEntry,
  openStorefront,
  phoneLabel,
  signUp,
  toast,
} from "./support/app";
import { DEMO_SHOP_SLUG, newAccount, newShopDetails, PHONE_KEYS, PHONES, token, type PhoneKey } from "./support/data";
import { expect, test } from "./support/fixtures";
import { saveShop, sessionFile, type ListedPhone } from "./support/state";

/*
 * Scenarios 1 and 2 build the shop that every other scenario uses. They run
 * once per viewport, in order, and hand over the retailer's session and the
 * shop's details when they are done.
 */
test.describe.configure({ mode: "serial" });

const owner = newAccount("Meera", "Kulkarni");
const shop = newShopDetails("Lotus", "Camp, Pune");
// One unbroken, unique word, so scenario 10 can search public responses for it.
const privateNote = `private-note-${token(12)}`;

test("1 · A new retailer signs up and creates a business", async ({ page, request, layout }) => {
  await signUp(page, owner);
  await describeShop(page, owner, shop);

  // Onboarding suggests an address from the shop name and checks it live.
  await expect(addressField(page)).toHaveValue(shop.suggestedSlug);
  await expect(addressField(page)).toHaveAccessibleDescription("Available");

  // An address another shop already uses cannot be claimed.
  await addressField(page).fill(DEMO_SHOP_SLUG);
  await expect(addressField(page)).toHaveAccessibleDescription("That address is already taken.");
  await expect(page.getByRole("button", { name: "Create my storefront" })).toBeDisabled();

  await claimAddress(page, shop.slug);
  await expect(page.getByText(`/shop/${shop.slug}`, { exact: true }).filter({ visible: true })).toBeVisible();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await finishOnboarding(page, shop);

  // The storefront is public straight away, at the chosen address, and empty.
  const { data } = await fetchCatalog(request, shop.slug);
  expect(data.shop).toMatchObject({
    name: shop.name,
    slug: shop.slug,
    whatsappNumber: shop.whatsappInternational,
    isDemo: false,
  });
  expect(data.devices).toEqual([]);

  await page.context().storageState({ path: sessionFile(layout) });
});

test("2 · The retailer adds three devices", async ({ retailerPage: page, request, layout }) => {
  await page.goto("/dashboard/inventory");
  await expect(page.getByRole("heading", { level: 3, name: "No devices yet" })).toBeVisible();
  await page.getByRole("link", { name: "Add your first device" }).click();
  await expect(page).toHaveURL(/\/dashboard\/inventory\/new$/);
  await expect(page.getByRole("heading", { level: 1, name: "Add a device" })).toBeVisible();

  // Suggestions speed up typing: a few letters are enough to pick from the list.
  const brand = page.getByRole("combobox", { name: "Brand" });
  await brand.fill("App");
  await page.getByRole("option", { name: "Apple", exact: true }).click();
  await expect(brand).toHaveValue("Apple");
  const model = page.getByRole("combobox", { name: "Model" });
  await model.fill("iPhone 14");
  await page.getByRole("option", { name: "iPhone 14 Pro", exact: true }).click();
  await expect(model).toHaveValue("iPhone 14 Pro");

  const references = {} as Record<PhoneKey, string>;
  for (const key of PHONE_KEYS) {
    const phone = PHONES[key];
    const isLast = key === PHONE_KEYS.at(-1);
    references[key] = await fillDeviceForm(page, phone, { notes: key === "fold" ? privateNote : undefined });

    await page.getByRole("button", { name: isLast ? "Add device" : "Save and add another", exact: true }).click();
    await expect(toast(page, "Device added").filter({ hasText: phoneLabel(phone) })).toBeVisible();
    // "Save and add another" leaves a clean form with the next reference.
    if (!isLast) {
      await expect(model).toHaveValue("");
      await expect(page.getByRole("textbox", { name: "Inventory reference" })).not.toHaveValue(references[key]);
    }
  }
  expect(new Set(Object.values(references)).size, "every phone gets its own reference").toBe(PHONE_KEYS.length);

  // Back in the inventory, each phone is its own record.
  await expect(page).toHaveURL(/\/dashboard\/inventory$/);
  const phones = {} as Record<PhoneKey, ListedPhone>;
  for (const key of PHONE_KEYS) {
    const phone = PHONES[key];
    const entry = inventoryEntry(page, layout, phone);
    await expect(entry).toContainText(phone.priceLabel);
    await expect(entry).toContainText(references[key]);
    await expect(entry.getByText("Available", { exact: true })).toBeVisible();
    const href = await entry.getByRole("link", { name: phone.title }).getAttribute("href");
    expect(href).toMatch(/^\/dashboard\/inventory\/[0-9a-f-]{36}$/);
    phones[key] = { id: href!.split("/").at(-1)!, reference: references[key], path: "" };
  }
  await expect(
    page.getByRole(layout === "desktop" ? "row" : "listitem").filter({ has: page.getByRole("button", { name: "Mark sold" }) }),
  ).toHaveCount(PHONE_KEYS.length);

  // And each one is live on the storefront. The preview flag keeps the
  // retailer's own visit out of the shop's visitor count.
  await openStorefront(page, shop.slug, "?preview=1");
  await expectCatalog(page, Object.values(PHONES));
  for (const key of PHONE_KEYS) {
    const path = await catalogCard(page, PHONES[key]).getByRole("link").getAttribute("href");
    expect(path).toMatch(new RegExp(`^/shop/${shop.slug}/[a-z0-9-]+$`));
    phones[key].path = path!;
  }

  const { data } = await fetchCatalog(request, shop.slug);
  expect(data.devices.map((device) => device.reference).sort()).toEqual(Object.values(references).sort());

  saveShop(layout, {
    name: shop.name,
    slug: shop.slug,
    location: shop.location,
    whatsappNumber: shop.whatsappInternational,
    ownerEmail: owner.email,
    privateNote,
    phones,
  });
});
