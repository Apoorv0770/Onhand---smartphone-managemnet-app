import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/* ---------------------------------------------------------------------------
   Where one `playwright test` run keeps its files.

   Every run gets its own throwaway folder under the system temp directory:

     <tmp>/onhand-e2e-xxxxxxxx/
       data/      the app's demo database and uploads (ONHAND_DATA_DIR)
       state/     what scenarios 1 and 2 hand to the later scenarios

   Nothing is ever read from or written to the project's own ./.data folder.
   The path is chosen once, in the process that loads playwright.config.ts, and
   passed to the workers through the environment so they all agree on it.
--------------------------------------------------------------------------- */

const RUN_DIR_ENV = "ONHAND_E2E_RUN_DIR";
const RUN_DIR_PREFIX = "onhand-e2e-";

export function runDir(): string {
  const existing = process.env[RUN_DIR_ENV];
  if (existing) return existing;
  const suffix = Math.random().toString(36).slice(2, 10).padEnd(8, "0");
  const chosen = path.join(os.tmpdir(), `${RUN_DIR_PREFIX}${suffix}`);
  process.env[RUN_DIR_ENV] = chosen;
  return chosen;
}

/** The folder the app under test uses as its data directory. */
export function appDataDir(): string {
  return path.join(runDir(), "data");
}

export function stateDir(): string {
  return path.join(runDir(), "state");
}

/**
 * Deletes the run folder. Refuses anything that does not look like a folder
 * this suite created, so a stray environment variable can never point it at
 * real data.
 */
export function removeRunDir(): void {
  const dir = process.env[RUN_DIR_ENV];
  if (!dir) return;
  const resolved = path.resolve(dir);
  const insideTemp = path.dirname(resolved) === path.resolve(os.tmpdir());
  if (!insideTemp || !path.basename(resolved).startsWith(RUN_DIR_PREFIX)) return;
  fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
