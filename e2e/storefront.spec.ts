import type { Locator, Page } from "@playwright/test";
import { catalog, catalogCard, closeFilters, expectCatalog, fetchCatalog, openFilters, openStorefront } from "./support/app";
import { DEMO_SHOP_SLUG, PHONE_KEYS, PHONES } from "./support/data";
import { expect, test } from "./support/fixtures";

/*
 * What a customer can do on a storefront. These scenarios only read, and they
 * never look at a price or an availability that scenarios 7 to 10 change, so
 * they can run alongside them.
 */

const ALL_PHONES = Object.values(PHONES);

function searchBox(page: Page): Locator {
  return page.getByRole("searchbox", { name: "Search phones by brand, model, storage or colour" });
}

/** Splits a wa.me link into the number it opens and the message it prefills. */
async function readWhatsAppLink(link: Locator): Promise<{ host: string; number: string; message: string | null }> {
  const url = new URL((await link.getAttribute("href")) ?? "");
  return { host: url.host, number: url.pathname.slice(1), message: url.searchParams.get("text") };
}

test("3 · The public storefront shows exactly those devices", async ({ page, request, shop }) => {
  await openStorefront(page, shop.slug);
  await expect(page).toHaveTitle(`${shop.name} · Phones in stock`);
  await expect(page.getByRole("heading", { level: 1, name: shop.name })).toBeVisible();
  await expect(page.getByText(shop.location, { exact: true }).filter({ visible: true }).first()).toBeVisible();

  // The retailer's three phones, and nothing from any other shop.
  await expectCatalog(page, ALL_PHONES);
  await expect(catalog(page).getByRole("listitem")).toHaveCount(ALL_PHONES.length);
  for (const phone of ALL_PHONES) {
    const card = catalogCard(page, phone);
    await expect(card).toContainText(phone.brand);
    await expect(card).toContainText(`${phone.storage} · ${phone.colour}`);
    await expect(card).toContainText(phone.condition);
  }

  // The public JSON agrees, and identifies phones by reference, not database id.
  const { data } = await fetchCatalog(request, shop.slug);
  expect(data.shop.isDemo).toBe(false);
  expect(data.devices.map((device) => device.reference).sort()).toEqual(
    PHONE_KEYS.map((key) => shop.phones[key].reference).sort(),
  );

  // It works the other way round too: another shop's catalog has none of them.
  const other = await fetchCatalog(request, DEMO_SHOP_SLUG);
  expect(other.data.devices.length).toBeGreaterThan(0);
  const ownIds = new Set(data.devices.map((device) => device.id));
  expect(other.data.devices.filter((device) => ownIds.has(device.id))).toEqual([]);
});

test("4 · A customer filters by brand", async ({ page, shop, layout }) => {
  await openStorefront(page, shop.slug);

  // Phones get one-tap brand chips under the search box. Wide screens show
  // the same choice in the filter sidebar, with the number of matching phones.
  const brandChip = async (brand: string) =>
    layout === "mobile"
      ? page.getByRole("button", { name: brand, exact: true })
      : (await openFilters(page, layout)).getByRole("button", { name: `${brand} 1`, exact: true });

  await (await brandChip("Samsung")).click();
  await expectCatalog(page, [PHONES.fold]);
  await expect(page.getByText("1 phone of 3", { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page).toHaveURL(/[?&]brand=Samsung(&|$)/);

  // Brands add up.
  await (await brandChip("Google")).click();
  await expectCatalog(page, [PHONES.fold, PHONES.pixel]);
  await expect(page).toHaveURL(/[?&]brand=Samsung(,|%2C)Google(&|$)/);

  // Each active filter can be removed on its own.
  await page.getByRole("button", { name: "Remove filter: Samsung" }).click();
  await expectCatalog(page, [PHONES.pixel]);
  await page.getByRole("button", { name: "Remove filter: Google" }).click();
  await expectCatalog(page, ALL_PHONES);
  await expect(page).not.toHaveURL(/brand=/);

  // A filtered view is a link that can be shared.
  await openStorefront(page, shop.slug, "?brand=Apple");
  await expectCatalog(page, [PHONES.iphone]);
  await expect(page.getByRole("button", { name: "Remove filter: Apple" })).toBeVisible();
});

test("5 · A customer filters by storage", async ({ page, shop, layout }) => {
  await openStorefront(page, shop.slug);

  let filters = await openFilters(page, layout);
  await filters.getByRole("button", { name: "256 GB 2", exact: true }).click();
  await closeFilters(page, layout, 2);
  await expectCatalog(page, [PHONES.iphone, PHONES.fold]);
  await expect(page.getByText("2 phones of 3", { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page).toHaveURL(/[?&]storage=256(&|$)/);

  // Switch to the other size.
  filters = await openFilters(page, layout);
  await filters.getByRole("button", { name: "256 GB 2", exact: true, pressed: true }).click();
  await filters.getByRole("button", { name: "128 GB 1", exact: true }).click();
  await closeFilters(page, layout, 1);
  await expectCatalog(page, [PHONES.pixel]);
  await expect(page).toHaveURL(/[?&]storage=128(&|$)/);

  await page.getByRole("button", { name: "Remove filter: 128 GB" }).click();
  await expectCatalog(page, ALL_PHONES);
});

test("6 · A customer searches for a model", async ({ page, shop }) => {
  await openStorefront(page, shop.slug);
  const search = searchBox(page);

  await search.fill("pixel");
  await expectCatalog(page, [PHONES.pixel]);
  await expect(page).toHaveURL(/[?&]q=pixel(&|$)/);

  // Several words narrow the search together, across model and storage.
  await search.fill("iphone 14 256");
  await expectCatalog(page, [PHONES.iphone]);

  // "256gb" finds "256 GB".
  await search.fill("256gb");
  await expectCatalog(page, [PHONES.iphone, PHONES.fold]);

  // Nothing matches: say so, and offer a way back.
  await search.fill("nokia 3310");
  await expect(catalog(page).getByRole("heading", { level: 3, name: "No matching phones found" })).toBeVisible();
  await expect(page.getByText("0 phones of 3", { exact: true }).filter({ visible: true })).toBeVisible();
  await catalog(page).getByRole("button", { name: "Clear search and filters" }).click();
  await expect(search).toHaveValue("");
  await expectCatalog(page, ALL_PHONES);

  await search.fill("fold");
  await expectCatalog(page, [PHONES.fold]);
  await page.getByRole("button", { name: "Clear search" }).click();
  await expectCatalog(page, ALL_PHONES);

  // A search is a link that can be shared.
  await openStorefront(page, shop.slug, "?q=deep+purple");
  await expect(searchBox(page)).toHaveValue("deep purple");
  await expectCatalog(page, [PHONES.iphone]);
});

test('11 · A customer taps "Inquire on WhatsApp"', async ({ page, shop, baseURL }) => {
  const listed = shop.phones.iphone;

  // From the catalog, the shop's general WhatsApp button starts a chat with the shop.
  await openStorefront(page, shop.slug);
  await expect
    .poll(() => readWhatsAppLink(page.getByRole("link", { name: "WhatsApp", exact: true })))
    .toEqual({
      host: "wa.me",
      number: shop.whatsappNumber,
      message: `Hi ${shop.name}, I was browsing your catalog and have a question.\n\n${baseURL}/shop/${shop.slug}`,
    });

  await catalogCard(page, PHONES.iphone).getByRole("link").click();
  await expect(page).toHaveURL(`${baseURL}${listed.path}`);
  await expect(page.getByRole("heading", { level: 1, name: PHONES.iphone.model })).toBeVisible();
  await expect(page.getByText(`Ref ${listed.reference}`, { exact: true }).filter({ visible: true })).toBeVisible();

  // The link is read, not followed: following it would leave the app for WhatsApp.
  // It names this exact phone, its inventory reference and the page it was found on.
  const inquire = page.getByRole("link", { name: "Inquire on WhatsApp" });
  await expect(inquire).toBeVisible();
  await expect
    .poll(() => readWhatsAppLink(inquire))
    .toEqual({
      host: "wa.me",
      number: shop.whatsappNumber,
      message: [
        "Hi, I found the iPhone 14 Pro, 256 GB, Deep Purple on your catalog. Is this specific device still available?",
        "",
        `Ref: ${listed.reference}`,
        `${baseURL}${listed.path}`,
      ].join("\n"),
    });
  await expect(inquire).toHaveAttribute("target", "_blank");
  await expect(inquire).toHaveAttribute("rel", /noopener/);
});
