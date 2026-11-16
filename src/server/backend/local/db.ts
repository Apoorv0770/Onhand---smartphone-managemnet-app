import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Activity, Business, Device, MemberRole, User } from "@/lib/types";
import { createSeedDatabase } from "./seed";

/* ---------------------------------------------------------------------------
   Demo-mode database: one JSON file on disk, cached in memory.

   Reads go through the cache and are revalidated against the file's mtime, so
   a second process (or a manual edit) is picked up. Writes are synchronous and
   atomic (temp file + rename), which keeps every mutation a single critical
   section on Node's event loop.
--------------------------------------------------------------------------- */

export interface LocalUser extends User {
  passwordHash: string;
}

export interface LocalSession {
  tokenHash: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface LocalMember {
  businessId: string;
  userId: string;
  role: MemberRole;
  createdAt: string;
}

export interface LocalEventsDay {
  views: number;
  inquiries: number;
  /** Inquiry taps keyed by device short id. */
  devices: Record<string, number>;
}

export interface LocalDb {
  version: 1;
  createdAt: string;
  users: LocalUser[];
  sessions: LocalSession[];
  businesses: Business[];
  members: LocalMember[];
  devices: Device[];
  activity: Activity[];
  /** businessId -> day (YYYY-MM-DD, IST) -> counters */
  events: Record<string, Record<string, LocalEventsDay>>;
}

export function dataDir(): string {
  const configured = process.env.ONHAND_DATA_DIR?.trim();
  // The data folder is chosen at runtime and must not be traced into the build.
  return configured
    ? path.resolve(/* turbopackIgnore: true */ configured)
    : path.join(/* turbopackIgnore: true */ process.cwd(), ".data");
}

export function uploadsDir(): string {
  return path.join(/* turbopackIgnore: true */ dataDir(), "uploads");
}

function dbFile(): string {
  return path.join(/* turbopackIgnore: true */ dataDir(), "db.json");
}

interface CacheEntry {
  file: string;
  mtimeMs: number;
  db: LocalDb;
}

const globalCache = globalThis as unknown as { __onhandLocalDb?: CacheEntry };

function persist(db: LocalDb): void {
  const file = dbFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(db, null, 2), "utf8");
  try {
    fs.renameSync(temp, file);
  } catch {
    // Windows can refuse to replace a file another process has open.
    fs.copyFileSync(temp, file);
    fs.rmSync(temp, { force: true });
  }
  globalCache.__onhandLocalDb = { file, mtimeMs: fs.statSync(file).mtimeMs, db };
}

function load(): LocalDb {
  const file = dbFile();
  if (!fs.existsSync(file)) {
    const seeded = createSeedDatabase();
    persist(seeded);
    return seeded;
  }
  const mtimeMs = fs.statSync(file).mtimeMs;
  const cached = globalCache.__onhandLocalDb;
  if (cached && cached.file === file && cached.mtimeMs === mtimeMs) return cached.db;
  const db = JSON.parse(fs.readFileSync(file, "utf8")) as LocalDb;
  globalCache.__onhandLocalDb = { file, mtimeMs, db };
  return db;
}

/** Read-only access. Callers must not mutate what they receive. */
export function read<T>(reader: (db: LocalDb) => T): T {
  return reader(load());
}

/**
 * Applies a change and writes it to disk before returning.
 * The writer works on a copy, so a thrown error leaves the database untouched.
 */
export function mutate<T>(writer: (db: LocalDb) => T): T {
  const draft = structuredClone(load());
  const result = writer(draft);
  persist(draft);
  return result;
}

/** Deep copy so callers can never mutate the cached database by accident. */
export function clone<T>(value: T): T {
  return structuredClone(value);
}
