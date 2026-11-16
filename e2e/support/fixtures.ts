import { test as base, expect, type Page } from "@playwright/test";
import { loadShop, sessionFile, type Layout, type ShopRecord } from "./state";

/** Per-project settings, set in playwright.config.ts. */
export interface Options {
  /** Which of the app's two layouts the project exercises. */
  layout: Layout;
}

interface Fixtures {
  /** The shop that scenarios 1 and 2 built for this viewport. */
  shop: ShopRecord;
  /**
   * A page signed in as that shop's owner. The built-in `page` fixture stays
   * signed out, so it always stands for a customer.
   */
  retailerPage: Page;
}

// The second argument of a fixture is conventionally called `use`. It is named
// `provide` here because the React hooks lint rule mistakes `use(...)` for a hook.
export const test = base.extend<Fixtures & Options>({
  layout: ["desktop", { option: true }],

  shop: async ({ layout }, provide) => {
    await provide(loadShop(layout));
  },

  retailerPage: async ({ browser, layout }, provide) => {
    const context = await browser.newContext({ storageState: sessionFile(layout) });
    const page = await context.newPage();
    await provide(page);
    await context.close();
  },
});

export { expect };
export type { Layout };
