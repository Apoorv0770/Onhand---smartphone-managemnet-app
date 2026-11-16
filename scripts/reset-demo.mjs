#!/usr/bin/env node
/**
 * Deletes the local demo database and uploaded images.
 * The three fictional demo retailers are created again the next time the app
 * handles a request. Accounts and shops you created in demo mode are removed.
 *
 *   npm run demo:reset
 */
import fs from "node:fs";
import path from "node:path";

const configured = process.env.ONHAND_DATA_DIR?.trim();
const directory = configured ? path.resolve(configured) : path.join(process.cwd(), ".data");

if (!fs.existsSync(directory)) {
  console.log(`Nothing to reset: ${directory} does not exist yet.`);
  process.exit(0);
}

// Only ever remove a folder that looks like ours.
const known = new Set(["db.json", "uploads"]);
const entries = fs.readdirSync(directory);
const unexpected = entries.filter((entry) => !known.has(entry) && !/^db\.json\.\d+\.tmp$/.test(entry));
if (unexpected.length > 0) {
  console.error(`Refusing to delete ${directory}: it contains files this app did not create (${unexpected.join(", ")}).`);
  process.exit(1);
}

fs.rmSync(directory, { recursive: true, force: true });
console.log(`Removed ${directory}. Fresh demo data will be created on the next request.`);
