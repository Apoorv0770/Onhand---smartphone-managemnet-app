import fs from "node:fs";
import path from "node:path";
import type { FullConfig } from "@playwright/test";
import { DEMO_SHOP_SLUG } from "./data";
import { appDataDir, removeRunDir } from "./run";

/**
 * Safety interlock, run once before any test.
 *
 * The scenarios create accounts, shops and phones. This proves that the server
 * they are about to use is the throwaway one: in demo mode, with its data in
 * this run's temp folder. If either check fails nothing runs, so a
 * misconfiguration can never write test data into a real Supabase project or
 * into the project's own ./.data folder.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.webServer?.url;
  if (!baseURL) throw new Error("playwright.config.ts must start the app under test through webServer.");

  const problems: string[] = [];

  // Only demo mode puts the one-tap demo shops on the sign-in page.
  const login = await fetch(`${baseURL}/login`);
  if (!login.ok || !(await login.text()).includes("Just looking? Open a demo shop")) {
    problems.push("the sign-in page does not offer the demo shops, so the app is not in demo mode");
  }

  // Reading a storefront makes the demo driver create its database. It has to
  // appear in this run's own folder, which a Supabase-backed server never touches.
  const storefront = await fetch(`${baseURL}/api/public/shops/${DEMO_SHOP_SLUG}`);
  if (!storefront.ok) {
    problems.push(`the demo storefront "${DEMO_SHOP_SLUG}" is missing (HTTP ${storefront.status})`);
  }
  if (!fs.existsSync(path.join(appDataDir(), "db.json"))) {
    problems.push(`the server did not create its demo database in ${appDataDir()}`);
  }

  if (problems.length > 0) {
    removeRunDir();
    throw new Error(
      `Refusing to run the end-to-end tests against ${baseURL}:\n` +
        problems.map((problem) => `  - ${problem}`).join("\n") +
        "\nThe tests create accounts and inventory, so they only run against a demo-mode server on throwaway data.",
    );
  }
}
