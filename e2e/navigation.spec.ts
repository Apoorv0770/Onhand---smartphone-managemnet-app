import { closeFilters, expectCatalog, openFilters, openStorefront } from "./support/app";
import { PHONES } from "./support/data";
import { expect, test } from "./support/fixtures";

/*
 * Scenario 13: how each part of the app is navigated on a phone. The tag keeps
 * these tests out of the desktop project, where none of these controls exist.
 */
test.describe("13 · Mobile navigation", { tag: "@phone-only" }, () => {
  test("the dashboard tab bar", async ({ retailerPage: page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();

    // The bottom tab bar is the only dashboard navigation on a phone.
    const tabs = page.getByRole("navigation", { name: "Dashboard" });
    await expect(tabs).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Toggle sidebar" })).toBeHidden();
    await expect(tabs.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");

    await tabs.getByRole("link", { name: "Inventory" }).click();
    await expect(page).toHaveURL(/\/dashboard\/inventory$/);
    await expect(page.getByRole("heading", { level: 1, name: "Inventory" })).toBeVisible();
    await expect(tabs.getByRole("link", { name: "Inventory" })).toHaveAttribute("aria-current", "page");
    await expect(tabs.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");

    await tabs.getByRole("link", { name: "Storefront" }).click();
    await expect(page).toHaveURL(/\/dashboard\/storefront$/);
    await expect(page.getByRole("heading", { level: 1, name: "Storefront" })).toBeVisible();

    // The round button in the middle goes straight to the "add a device" form.
    await tabs.getByRole("link", { name: "Add a device" }).click();
    await expect(page).toHaveURL(/\/dashboard\/inventory\/new$/);
    await expect(page.getByRole("heading", { level: 1, name: "Add a device" })).toBeVisible();

    // Everything else sits behind "More", in a bottom drawer.
    await tabs.getByRole("button", { name: "More" }).click();
    const more = page.getByRole("dialog", { name: "More" });
    await expect(more.getByRole("link", { name: "Settings" })).toBeVisible();
    await expect(more.getByRole("button", { name: "Sign out" })).toBeVisible();
    await more.getByRole("link", { name: "Activity" }).click();
    await expect(more).toBeHidden();
    await expect(page).toHaveURL(/\/dashboard\/activity$/);
    await expect(page.getByRole("heading", { level: 1, name: "Activity" })).toBeVisible();

    await tabs.getByRole("link", { name: "Overview" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
  });

  test("the storefront filter drawer", async ({ page, shop }) => {
    await openStorefront(page, shop.slug);
    // No filter sidebar on a phone: the filters open from a button instead.
    await expect(page.getByRole("complementary", { name: "Filters" })).toBeHidden();

    const drawer = await openFilters(page, "mobile");
    for (const group of ["Brand", "Model", "Storage", "Battery health", "Condition", "Colour"]) {
      await expect(drawer.getByRole("heading", { level: 3, name: group, exact: true })).toBeVisible();
    }

    // The button at the bottom counts the matches as filters change.
    await drawer.getByRole("button", { name: "Apple 1", exact: true }).click();
    await expect(drawer.getByRole("button", { name: "Show 1 phone", exact: true })).toBeVisible();
    await drawer.getByRole("button", { name: "Clear all" }).click();
    await expect(drawer.getByRole("button", { name: "Show 3 phones", exact: true })).toBeVisible();

    await drawer.getByRole("button", { name: "Google 1", exact: true }).click();
    await closeFilters(page, "mobile", 1);
    await expectCatalog(page, [PHONES.pixel]);
    // Back on the catalog, the button shows how many filters are active.
    await expect(page.getByRole("button", { name: "Filters 1", exact: true })).toBeVisible();

    // The drawer also closes without applying anything new.
    await openFilters(page, "mobile");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Filters" })).toBeHidden();
    await expectCatalog(page, [PHONES.pixel]);
  });

  test("the marketing menu", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: /Your inventory/ })).toBeVisible();
    // The section links live in a menu on a phone, not in the header.
    await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden();

    await page.getByRole("button", { name: "Open menu" }).click();
    const menu = page.getByRole("dialog", { name: "Menu" });
    for (const link of ["How it works", "Features", "Live preview", "Customise", "FAQ"]) {
      await expect(menu.getByRole("link", { name: link, exact: true })).toBeVisible();
    }
    await expect(menu.getByRole("link", { name: "Create your storefront" })).toHaveAttribute("href", "/signup");
    await expect(menu.getByRole("link", { name: "Explore live demo" })).toHaveAttribute("href", /^\/shop\//);

    // A section link closes the menu and jumps to that section.
    await menu.getByRole("link", { name: "How it works", exact: true }).click();
    await expect(menu).toBeHidden();
    await expect(page).toHaveURL(/#how-it-works$/);
    await expect(page.locator("#how-it-works")).toBeInViewport();

    await page.getByRole("button", { name: "Open menu" }).click();
    await menu.getByRole("link", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { level: 1, name: "Welcome back" })).toBeVisible();
  });
});
