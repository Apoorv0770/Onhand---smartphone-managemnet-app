import { catalog } from "./support/app";
import { DEMO_SHOP_SLUG, PHONES, token } from "./support/data";
import { expect, test } from "./support/fixtures";

test.describe("14 · An invalid storefront URL shows a designed not-found page", () => {
  test("an unknown storefront", async ({ page, request }) => {
    const slug = `no-such-shop-${token()}`;
    await page.goto(`/shop/${slug}`);

    await expect(page.getByRole("heading", { level: 1, name: "This storefront does not exist" })).toBeVisible();
    await expect(page.getByText("Error 404", { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(page).toHaveTitle(/Storefront not found/);
    // It offers somewhere to go next.
    await expect(page.getByRole("link", { name: "Open the demo storefront" })).toHaveAttribute(
      "href",
      `/shop/${DEMO_SHOP_SLUG}`,
    );
    await expect(page.getByRole("link", { name: "Go to Onhand" })).toHaveAttribute("href", "/");
    // Search engines are told to leave the page out.
    await expect
      .poll(() =>
        page
          .locator('meta[name="robots"]')
          .evaluateAll((tags) => tags.map((tag) => tag.getAttribute("content")).join(" ")),
      )
      .toContain("noindex");

    // The JSON API answers with a real 404.
    const response = await request.get(`/api/public/shops/${slug}`);
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: "Storefront not found" });
  });

  test("an unknown phone in a real storefront", async ({ page, shop }) => {
    await page.goto(`/shop/${shop.slug}/phone-that-was-never-listed-${token()}`);

    await expect(page.getByRole("heading", { level: 1, name: "This phone is no longer listed" })).toBeVisible();
    await expect(
      page.getByText(`It may have been sold or removed by ${shop.name}.`).filter({ visible: true }),
    ).toBeVisible();
    await expect(page).toHaveTitle(`No longer listed · ${shop.name}`);
    // Instead of a dead end, it shows what the shop does have. The iPhone is
    // never sold by another scenario, so it is always among them.
    await expect(page.getByRole("heading", { level: 3, name: PHONES.iphone.model, exact: true })).toBeVisible();

    // And it leads back to the shop's catalog.
    await page.getByRole("link", { name: `Browse ${shop.name}` }).click();
    await expect(page).toHaveURL(new RegExp(`/shop/${shop.slug}$`));
    await expect(page.getByRole("heading", { level: 2, name: "Phones in stock" })).toBeVisible();
    await expect(catalog(page).getByRole("listitem").first()).toBeVisible();
  });
});
