import type { Page } from "@playwright/test";
import {
  addFirstPhone,
  addressField,
  chooseFromPhoneMenu,
  claimAddress,
  describeShop,
  expectCatalog,
  fetchCatalog,
  finishOnboarding,
  inventoryEntry,
  openInventory,
  openStorefront,
  signUp,
  toast,
} from "./support/app";
import { newAccount, newShopDetails, PHONE_KEYS, PHONES, RIVAL_PHONE } from "./support/data";
import { expect, test } from "./support/fixtures";

const NOT_YOURS = "That device is no longer in your inventory.";

/**
 * Turns the second retailer's own actions into attacks on someone else's phone.
 *
 * The dashboard only ever lets a retailer act on their own phones, so a
 * request for another shop's phone has to be forged. While this is active,
 * every server action the page sends for `ownId` is re-addressed to
 * `targetId` on its way out: the same session, the same action, another
 * tenant's device id. This is what a retailer tampering with the requests
 * from their own browser could send.
 */
async function forgeDeviceId(page: Page, ownId: string, targetId: string): Promise<{ sent: () => number }> {
  let sent = 0;
  await page.route(
    (url) => url.pathname.startsWith("/dashboard"),
    async (route) => {
      const request = route.request();
      const body = request.postData();
      const isServerAction = request.method() === "POST" && request.headers()["next-action"] !== undefined;
      if (isServerAction && body?.includes(ownId)) {
        sent += 1;
        await route.continue({ postData: body.replaceAll(ownId, targetId) });
      } else {
        await route.fallback();
      }
    },
  );
  return { sent: () => sent };
}

test("12 · Another retailer cannot read or change the inventory", async ({
  page,
  request,
  retailerPage,
  shop,
  layout,
}) => {
  // The first retailer's iPhone. No other scenario changes it.
  const target = shop.phones.iphone;
  const rival = newAccount("Kabir", "Shaikh");
  const rivalShop = newShopDetails("Nova", "Sitabuldi, Nagpur");

  await test.step("a second retailer opens a shop with one phone of their own", async () => {
    await signUp(page, rival);
    await describeShop(page, rival, rivalShop);

    // The first retailer's address is theirs alone.
    await addressField(page).fill(shop.slug);
    await expect(addressField(page)).toHaveAccessibleDescription("That address is already taken.");
    await expect(page.getByRole("button", { name: "Create my storefront" })).toBeDisabled();

    await claimAddress(page, rivalShop.slug);
    await addFirstPhone(page, RIVAL_PHONE);
    await finishOnboarding(page, rivalShop);
  });

  await test.step("they see only their own phone", async () => {
    await openInventory(page);
    await expect(inventoryEntry(page, layout, RIVAL_PHONE)).toBeVisible();
    for (const phone of Object.values(PHONES)) {
      await expect(inventoryEntry(page, layout, phone)).toHaveCount(0);
    }
    await openStorefront(page, rivalShop.slug, "?preview=1");
    await expectCatalog(page, [RIVAL_PHONE]);
  });

  await test.step("they cannot open the first retailer's phone", async () => {
    await page.goto(`/dashboard/inventory/${target.id}`);
    await expect(page.getByRole("heading", { name: "This device is not in your inventory" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save changes" })).toBeHidden();
    await expect(page.getByRole("main")).not.toContainText(PHONES.iphone.model);
    await expect(page.getByRole("main")).not.toContainText(target.reference);
  });

  await test.step("they cannot change it, even with forged requests", async () => {
    await openInventory(page);
    const entry = inventoryEntry(page, layout, RIVAL_PHONE);
    const ownHref = await entry.getByRole("link", { name: RIVAL_PHONE.title }).getAttribute("href");
    const ownId = ownHref!.split("/").at(-1)!;
    const forged = await forgeDeviceId(page, ownId, target.id);

    // Mark sold.
    await entry.getByRole("button", { name: "Mark sold" }).click();
    await expect(toast(page, "Could not update the device")).toContainText(NOT_YOURS);
    expect(forged.sent()).toBe(1);

    // Hide the price.
    await chooseFromPhoneMenu(entry, "Hide price publicly");
    await expect(toast(page, "Could not change price visibility")).toContainText(NOT_YOURS);
    expect(forged.sent()).toBe(2);

    // Delete.
    await chooseFromPhoneMenu(entry, "Delete device");
    const confirm = page.getByRole("alertdialog", { name: "Delete this device?" });
    await confirm.getByRole("button", { name: "Delete device" }).click();
    await expect(toast(page, "Could not delete the device")).toContainText(NOT_YOURS);
    await expect(confirm).toBeHidden();
    expect(forged.sent()).toBe(3);

    // Edit: overwrite it with the details of their own phone.
    await entry.getByRole("link", { name: RIVAL_PHONE.title }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Edit device" })).toBeVisible();
    await page.getByRole("textbox", { name: "Asking price" }).fill("1");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(toast(page, "Could not save changes")).toContainText(NOT_YOURS);
    expect(forged.sent()).toBe(4);
  });

  await test.step("the first retailer's phone is exactly as they left it", async () => {
    const { data } = await fetchCatalog(request, shop.slug);
    expect(data.devices).toHaveLength(PHONE_KEYS.length);
    expect(data.devices.find((device) => device.reference === target.reference)).toMatchObject({
      brand: PHONES.iphone.brand,
      model: PHONES.iphone.model,
      storageGb: PHONES.iphone.storageGb,
      colour: PHONES.iphone.colour,
      availability: "available",
      price: PHONES.iphone.price,
    });

    await retailerPage.goto(`/dashboard/inventory/${target.id}`);
    await expect(retailerPage.getByRole("heading", { level: 1, name: "Edit device" })).toBeVisible();
    await expect(retailerPage.getByRole("combobox", { name: "Model" })).toHaveValue(PHONES.iphone.model);
    await expect(retailerPage.getByRole("textbox", { name: "Asking price" })).toHaveValue(
      PHONES.iphone.priceLabel.replace("₹", ""),
    );
    await expect(retailerPage.getByRole("switch", { name: "Show price on storefront" })).toBeChecked();
  });

  await test.step("signed-out requests get nowhere", async () => {
    const dashboard = await request.get(`/dashboard/inventory/${target.id}`, { maxRedirects: 0 });
    expect(dashboard.status()).toBeGreaterThanOrEqual(300);
    expect(dashboard.status()).toBeLessThan(400);
    expect(new URL(dashboard.headers()["location"], "http://placeholder").pathname).toBe("/login");

    const upload = await request.post("/api/uploads");
    expect(upload.status()).toBe(401);
  });
});
