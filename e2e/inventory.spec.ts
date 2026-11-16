import type { APIRequestContext } from "@playwright/test";
import {
  catalogCard,
  chooseFromPhoneMenu,
  fetchCatalog,
  inventoryEntry,
  openInventory,
  openStorefront,
  phoneLabel,
  toast,
} from "./support/app";
import { PHONE_KEYS, PHONES, type PhoneKey } from "./support/data";
import { expect, test } from "./support/fixtures";
import type { ShopRecord } from "./support/state";

/*
 * The retailer changes a phone in the dashboard, then a customer looks at the
 * storefront. Each pair runs in order: the customer's half only means
 * something once the retailer's half has happened.
 */

/** One phone as the public JSON describes it right now. */
async function publicPhone(request: APIRequestContext, shop: ShopRecord, key: PhoneKey) {
  const { data } = await fetchCatalog(request, shop.slug);
  const device = data.devices.find((candidate) => candidate.reference === shop.phones[key].reference);
  expect(device, `${PHONES[key].title} is in the public catalog`).toBeDefined();
  return device!;
}

test.describe("selling a phone", () => {
  test.describe.configure({ mode: "serial" });

  test("7 · The retailer marks a device sold with one tap", async ({ retailerPage: page, request, shop, layout }) => {
    await openInventory(page);
    const entry = inventoryEntry(page, layout, PHONES.pixel);
    await expect(entry.getByText("Available", { exact: true })).toBeVisible();

    // One tap, no confirmation.
    await entry.getByRole("button", { name: "Mark sold" }).click();
    await expect(entry.getByText("Sold", { exact: true })).toBeVisible();
    await expect(toast(page, "Marked as sold")).toContainText(
      `${phoneLabel(PHONES.pixel)} now shows as sold on your storefront.`,
    );
    await expect.poll(async () => (await publicPhone(request, shop, "pixel")).availability).toBe("sold");

    // A slip of the thumb can be undone from the confirmation.
    await toast(page, "Marked as sold").getByRole("button", { name: "Undo" }).click();
    await expect(toast(page, "Marked as available")).toBeVisible();
    await expect(entry.getByText("Available", { exact: true })).toBeVisible();
    await expect.poll(async () => (await publicPhone(request, shop, "pixel")).availability).toBe("available");

    // Sold for real this time. The same button now offers the way back.
    await entry.getByRole("button", { name: "Mark sold" }).click();
    await expect(entry.getByRole("button", { name: "Mark available" })).toBeVisible();
    await expect.poll(async () => (await publicPhone(request, shop, "pixel")).availability).toBe("sold");

    // It is saved, not just shown: the inventory still says so after a reload.
    await page.reload();
    await expect(inventoryEntry(page, layout, PHONES.pixel).getByText("Sold", { exact: true })).toBeVisible();
  });

  test("8 · The customer sees the new availability", async ({ page, request, shop }) => {
    await openStorefront(page, shop.slug);
    const card = catalogCard(page, PHONES.pixel);
    await expect(card.getByText("Sold", { exact: true })).toBeVisible();
    await expect(card).toContainText("No longer available");
    await expect(card).not.toContainText(PHONES.pixel.priceLabel);
    await expect(page.getByText("2 phones available", { exact: true }).filter({ visible: true })).toBeVisible();
    // The other phones are untouched.
    await expect(catalogCard(page, PHONES.iphone).getByText("Available", { exact: true })).toBeVisible();
    await expect(catalogCard(page, PHONES.fold).getByText("Available", { exact: true })).toBeVisible();

    // The phone's own page stays up, says it is sold, and stops offering an inquiry about it.
    await card.getByRole("link").click();
    await expect(page.getByRole("heading", { level: 1, name: PHONES.pixel.model })).toBeVisible();
    await expect(page.getByText("This phone has been sold", { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ask about similar phones" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Inquire on WhatsApp" })).toBeHidden();

    // A sold phone no longer publishes a price.
    expect(await publicPhone(request, shop, "pixel")).toMatchObject({ availability: "sold", price: null });
  });
});

test.describe("hiding a price", () => {
  test.describe.configure({ mode: "serial" });

  test("9 · The retailer hides a public price", async ({ retailerPage: page, request, shop, layout }) => {
    expect((await publicPhone(request, shop, "fold")).price, "the price starts out public").toBe(PHONES.fold.price);

    await openInventory(page);
    const entry = inventoryEntry(page, layout, PHONES.fold);
    await expect(entry.getByLabel("Shown publicly")).toBeVisible();

    await chooseFromPhoneMenu(entry, "Hide price publicly");
    await expect(toast(page, "Price hidden from customers")).toContainText(
      `${phoneLabel(PHONES.fold)} now shows "Price on request".`,
    );

    // The retailer keeps seeing their own price, now marked as hidden.
    await expect(entry).toContainText(PHONES.fold.priceLabel);
    await expect(entry.getByLabel("Hidden publicly")).toBeVisible();
    await entry.getByRole("button", { name: /^More actions for/ }).click();
    await expect(page.getByRole("menuitem", { name: "Show price publicly" })).toBeVisible();
    await page.keyboard.press("Escape");

    await expect.poll(async () => (await publicPhone(request, shop, "fold")).price).toBeNull();
  });

  test("10 · Public responses do not contain the hidden price", async ({ page, request, shop }) => {
    const hidden = PHONES.fold;
    const listed = shop.phones.fold;

    /*
     * Nothing a visitor can fetch may carry the price, in digits or as printed.
     * While at it, the same goes for the internal notes and for every phone's
     * database id.
     */
    const secrets = [
      String(hidden.price),
      hidden.priceLabel.replace("₹", ""),
      shop.privateNote,
      ...PHONE_KEYS.map((key) => shop.phones[key].id),
    ];
    const expectNoSecrets = (body: string, where: string) => {
      for (const secret of secrets) {
        expect(body.includes(secret), `${where} contains "${secret}"`).toBe(false);
      }
    };
    // The same search does find a price that is public, so it would find a leak.
    const publicPrice = String(PHONES.iphone.price);

    // 1. The JSON API.
    const api = await fetchCatalog(request, shop.slug);
    expect((await publicPhone(request, shop, "fold")).price).toBeNull();
    expect(api.raw).toContain(publicPrice);
    expectNoSecrets(api.raw, "the JSON API");

    // 2. The catalog page as the server sends it, including the React payload inlined in it.
    const catalogHtml = await (await request.get(`/shop/${shop.slug}`)).text();
    expect(catalogHtml).toContain(listed.reference);
    expect(catalogHtml).toContain(publicPrice);
    expectNoSecrets(catalogHtml, "the catalog HTML");

    // 3. The phone's own page.
    const deviceHtml = await (await request.get(listed.path)).text();
    expect(deviceHtml).toContain(listed.reference);
    expect(deviceHtml).toContain("Price on request");
    expectNoSecrets(deviceHtml, "the device HTML");

    // 4. The React payloads a browser fetches while a customer moves from the catalog to the phone.
    const payloads: Promise<string>[] = [];
    page.on("response", (response) => {
      if ((response.headers()["content-type"] ?? "").includes("text/x-component")) {
        payloads.push(response.text().catch(() => ""));
      }
    });
    await openStorefront(page, shop.slug);
    const card = catalogCard(page, hidden);
    await expect(card).toContainText("Price on request");
    await expect(card).not.toContainText(hidden.priceLabel);
    await card.getByRole("link").click();
    await expect(page.getByRole("heading", { level: 1, name: hidden.model })).toBeVisible();
    await expect(page.getByText("Price on request", { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(page.getByText("Message the shop and they will share the price.").filter({ visible: true })).toBeVisible();

    const fetched = await Promise.all(payloads);
    expect(
      fetched.filter((body) => body.includes(listed.reference)).length,
      "React payloads that describe the phone",
    ).toBeGreaterThan(0);
    for (const body of fetched) expectNoSecrets(body, "a React payload");
  });
});
