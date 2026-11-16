import { defineConfig, devices } from "@playwright/test";
import type { Options } from "./e2e/support/fixtures";
import { appDataDir } from "./e2e/support/run";

/*
 * End-to-end tests for the 14 scenarios in README.md ("Tests and verification").
 *
 * The suite starts its own copy of the app: a production build in its own
 * output folder, served on its own port, forced into demo mode, with its data
 * in a throwaway temp folder. It never talks to a server you started yourself,
 * never touches ./.data and never reaches Supabase, whatever .env.local says.
 */

// Not 3000: a development server may already be running there.
const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = `http://127.0.0.1:${PORT}`;

// Optional: an installed browser ("chrome" or "msedge") instead of the
// Chromium build that `npx playwright install chromium` downloads.
const channel = process.env.E2E_BROWSER_CHANNEL || undefined;

const desktop = { ...devices["Desktop Chrome"], channel, layout: "desktop" } as const;
// A 393 px wide Android phone: touch input, mobile user agent, phone layout.
const mobile = { ...devices["Pixel 5"], channel, layout: "mobile" } as const;

export default defineConfig<Options>({
  testDir: "./e2e",
  outputDir: "./test-results",
  // Checks that the server really is the throwaway demo one before any test runs.
  globalSetup: "./e2e/support/global-setup.ts",
  globalTeardown: "./e2e/support/global-teardown.ts",

  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // Two workers, on purpose. Every worker drives its own browser against the
  // same app server, so more of them mostly wait on each other: four finish
  // the run no sooner than two, and need over a gigabyte more memory.
  workers: 2,
  reporter: "list",
  // Generous, so a busy machine slows a run down instead of failing it.
  timeout: 90_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  /*
   * Each viewport runs in two steps. The "onboarding" project is scenarios 1
   * and 2: a new retailer signs up, creates a shop and lists three phones.
   * Every other scenario then runs against that shop, so it only starts once
   * the shop exists and is skipped, not failed, when it could not be built.
   */
  projects: [
    { name: "desktop-onboarding", testMatch: /onboarding\.setup\.ts$/, use: desktop },
    { name: "desktop", dependencies: ["desktop-onboarding"], grepInvert: /@phone-only/, use: desktop },
    { name: "mobile-onboarding", testMatch: /onboarding\.setup\.ts$/, use: mobile },
    { name: "mobile", dependencies: ["mobile-onboarding"], use: mobile },
  ],

  webServer: {
    // A production build: Next.js allows only one `next dev` per project, and
    // a build in its own output folder runs happily next to it.
    command: `npm run build && npm run start -- --hostname 127.0.0.1 --port ${PORT}`,
    url: BASE_URL,
    // Always our own server: reusing whatever answers on the port could mean
    // running the tests against real data.
    reuseExistingServer: false,
    timeout: 5 * 60_000,
    env: {
      // Demo mode, twice over. The switch makes the server ignore any Supabase
      // settings. The empty values, which win over .env.local, keep a real
      // project's address and key out of the compiled bundles altogether.
      ONHAND_FORCE_DEMO: "1",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      // Throwaway data, and a build that leaves ./.next (and whatever is
      // running from it) alone.
      ONHAND_DATA_DIR: appDataDir(),
      ONHAND_DIST_DIR: ".next-e2e",
      NEXT_PUBLIC_SITE_URL: BASE_URL,
    },
  },
});
