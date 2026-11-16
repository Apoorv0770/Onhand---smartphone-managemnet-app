import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite, type Results, type Transaction } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { COVER_STYLE_IDS } from "@/lib/catalog";
import { deviceLabel } from "@/lib/device";
import { istDay, istDayToIso } from "@/lib/format";
import { RESERVED_SLUGS } from "@/lib/schemas";
import type { BusinessInput, DeviceInput, StorefrontSettingsInput } from "@/lib/types";
import { SEED_BUSINESSES } from "@/server/backend/seed-data";
import {
  createSupabaseData,
  type ImageStorage,
  type RpcClient,
  type SupabaseData,
} from "@/server/backend/supabase/data";
import { AppError } from "@/server/errors";
import { buildSeedSql } from "../scripts/generate-supabase-seed.mjs";

/* ---------------------------------------------------------------------------
   Supabase mode, verified against a real Postgres.

   PGlite (Postgres compiled to WebAssembly) loads the actual migration from
   supabase/migrations/0001_init.sql. A small shim stands in for what the
   Supabase platform provides: the auth schema, auth.uid(), the anon and
   authenticated roles and Supabase's "grant everything in public" defaults.

   Requests are made the way PostgREST makes them: inside a transaction, with
   `set local role` and the caller's JWT claims in request.jwt.claims.

   Not covered here (needs a live Supabase project): Supabase Auth itself,
   Storage (0002_storage.sql) and the HTTP transport of supabase-js.
--------------------------------------------------------------------------- */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATION = fs.readFileSync(path.join(ROOT, "supabase/migrations/0001_init.sql"), "utf8");
const SEED_FILE = fs.readFileSync(path.join(ROOT, "supabase/seed.sql"), "utf8");

const SUPABASE_SHIM = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  -- The role Supabase Auth uses to write auth.users. It has no access to the
  -- app's schemas, which is what the sign-up trigger has to cope with.
  create role supabase_auth_admin nologin;

  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    raw_user_meta_data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
  );

  -- Same definition Supabase ships.
  create function auth.uid() returns uuid language sql stable as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
  $$;

  grant usage on schema public to anon, authenticated, service_role;
  grant usage on schema auth to anon, authenticated, service_role, supabase_auth_admin;
  grant all on auth.users to supabase_auth_admin;

  -- Supabase grants everything in "public" to its API roles by default.
  -- The migration has to hold up against that, so the shim does the same.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

type Identity = { role: "anon" } | { role: "authenticated"; sub: string };

const ANON: Identity = { role: "anon" };
const user = (sub: string): Identity => ({ role: "authenticated", sub });

const A = "a0000000-0000-4000-8000-00000000000a";
const B = "b0000000-0000-4000-8000-00000000000b";
const C = "c0000000-0000-4000-8000-00000000000c";
const D = "d0000000-0000-4000-8000-00000000000d";
const E = "e0000000-0000-4000-8000-00000000000e";

const PRIVATE_NOTE = "INTERNAL-NOTE-do-not-leak-7731";
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DENIED = /permission denied|row-level security/;

let db: PGlite;

/** Runs work as a given API role, exactly as one PostgREST request would. */
async function as<T>(identity: Identity, work: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    const claims = identity.role === "authenticated" ? { sub: identity.sub, role: "authenticated" } : { role: "anon" };
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    await tx.exec(`set local role ${identity.role}`);
    return work(tx);
  });
}

type Row = Record<string, unknown>;

function run<T = Row>(identity: Identity, sql: string, params: unknown[] = []): Promise<Results<T>> {
  return as(identity, (tx) => tx.query<T>(sql, params));
}

/** Superuser access for arranging and inspecting data. Bypasses RLS. */
function admin<T = Row>(sql: string, params: unknown[] = []): Promise<Results<T>> {
  return db.query<T>(sql, params);
}

async function scalar<T>(sql: string, params: unknown[] = []): Promise<T> {
  const result = await admin<{ value: T }>(sql, params);
  return result.rows[0].value;
}

/** A stand-in for supabase-js `rpc()`, backed by the test database. */
function rpcAs(identity: Identity): RpcClient {
  return {
    async rpc(fn, args = {}) {
      const names = Object.keys(args);
      if (!/^[a-z_]+$/.test(fn) || names.some((name) => !/^[a-z_]+$/.test(name))) {
        throw new Error(`Unexpected rpc call: ${fn}`);
      }
      const placeholders = names.map((name, index) => `${name} => $${index + 1}`).join(", ");
      try {
        const result = await run<{ result: unknown }>(
          identity,
          `select public.${fn}(${placeholders}) as result`,
          names.map((name) => args[name]),
        );
        return { data: result.rows[0]?.result ?? null, error: null };
      } catch (error) {
        const failure = error as { code?: string; message?: string; detail?: string; hint?: string };
        return {
          data: null,
          error: {
            code: failure.code ?? null,
            message: failure.message ?? String(error),
            details: failure.detail ?? null,
            hint: failure.hint ?? null,
          },
        };
      }
    },
  };
}

const PUBLIC_BASE = "https://project.supabase.test/storage/v1/object/public/device-images/";

interface FakeStorage extends ImageStorage {
  files: Map<string, Uint8Array>;
  removed: string[];
}

function fakeStorage(): FakeStorage {
  const files = new Map<string, Uint8Array>();
  const removed: string[] = [];
  return {
    publicBase: PUBLIC_BASE,
    files,
    removed,
    async upload(objectPath, image) {
      files.set(objectPath, image.bytes);
    },
    async remove(paths) {
      for (const objectPath of paths) {
        files.delete(objectPath);
        removed.push(objectPath);
      }
    },
  };
}

/** The real driver, pointed at the test database as one signed-in user. */
function driverFor(identity: Identity): { data: SupabaseData; storage: FakeStorage } {
  const storage = fakeStorage();
  const data = createSupabaseData({
    user: () => rpcAs(identity),
    anon: () => rpcAs(ANON),
    storage: () => storage,
  });
  return { data, storage };
}

async function appError(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    return error as AppError;
  }
  throw new Error("Expected the call to be rejected, but it succeeded.");
}

function businessInput(name: string, slug: string): BusinessInput {
  return {
    name,
    slug,
    description: "Test shop",
    location: "Amravati, Maharashtra",
    whatsappNumber: "919876543210",
    phoneNumber: null,
    instagramHandle: null,
  };
}

function deviceInput(overrides: Partial<DeviceInput> = {}): DeviceInput {
  return {
    brand: "Apple",
    model: "iPhone 13",
    storageGb: 128,
    colour: "Midnight",
    batteryHealth: 87,
    condition: "good",
    cosmeticCondition: "Light scratches",
    functionalCondition: "All working",
    accessories: ["Charging cable"],
    warranty: "7-day shop warranty",
    notes: PRIVATE_NOTE,
    price: 36500,
    showPrice: true,
    availabilityStatus: "available",
    inventoryReference: "T-0001",
    addedOn: "2099-01-01",
    images: [],
    ...overrides,
  };
}

function storefrontInput(base: BusinessInput, overrides: Partial<StorefrontSettingsInput> = {}): StorefrontSettingsInput {
  return {
    ...base,
    logoUrl: null,
    bannerUrl: null,
    coverStyle: "graphite",
    hours: null,
    showPricesByDefault: true,
    showSoldDevices: true,
    ...overrides,
  };
}

const TABLES = [
  "profiles",
  "businesses",
  "business_members",
  "devices",
  "device_images",
  "inventory_activity",
  "storefront_events",
];

const PUBLIC_FUNCTIONS = [
  "public.get_public_device",
  "public.get_public_shop",
  "public.list_public_devices",
  "public.record_storefront_event",
];

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_SHIM);
  await db.exec(MIGRATION);
  await db.exec(`
    insert into auth.users (id, email, raw_user_meta_data) values
      ('${A}', 'asha@example.com', '{"name": "Asha"}'),
      ('${B}', 'bhavesh@example.com', '{"name": "Bhavesh"}'),
      ('${C}', 'chitra@example.com', '{"name": "Chitra"}'),
      ('${D}', 'dev@example.com', '{}'),
      ('${E}', 'esha@example.com', '{"name": "Esha"}');
  `);
});

/* -------------------------------------------------------------------------- */

describe("migration", () => {
  it("can be applied twice without error", async () => {
    await expect(db.exec(MIGRATION)).resolves.toBeDefined();
  });

  it("enables row level security on every table", async () => {
    const result = await admin<{ relname: string; relrowsecurity: boolean }>(`
      select c.relname, c.relrowsecurity
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
      order by c.relname
    `);
    expect(result.rows.map((row) => row.relname).sort()).toEqual([...TABLES].sort());
    expect(result.rows.every((row) => row.relrowsecurity)).toBe(true);
  });

  it("gives storefront visitors no privilege on any table or column", async () => {
    const result = await admin<{ relname: string }>(`
      select c.relname
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'S')
        and (
          has_table_privilege('anon', c.oid, 'select')
          or has_table_privilege('anon', c.oid, 'insert')
          or has_table_privilege('anon', c.oid, 'update')
          or has_table_privilege('anon', c.oid, 'delete')
          or has_table_privilege('anon', c.oid, 'truncate')
          or (c.relkind = 'r' and has_any_column_privilege('anon', c.oid, 'select, insert, update, references'))
        )
    `);
    expect(result.rows).toEqual([]);
  });

  it("lets visitors execute only the four public storefront functions", async () => {
    const result = await admin<{ fn: string }>(`
      select n.nspname || '.' || p.proname as fn
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private') and has_function_privilege('anon', p.oid, 'execute')
      order by 1
    `);
    expect(result.rows.map((row) => row.fn)).toEqual(PUBLIC_FUNCTIONS);
  });

  it("keeps internal definer functions away from signed-in users too", async () => {
    const result = await admin<{ fn: string }>(`
      select n.nspname || '.' || p.proname as fn
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private') and has_function_privilege('authenticated', p.oid, 'execute')
    `);
    const executable = result.rows.map((row) => row.fn);
    for (const forbidden of [
      "private.public_device_json",
      "private.generate_short_id",
      "private.handle_new_user",
      "private.handle_user_email_change",
      "private.businesses_after_insert",
      "private.devices_before_write",
      "private.inventory_activity_before_insert",
    ]) {
      expect(executable, forbidden).not.toContain(forbidden);
    }
    for (const needed of [...PUBLIC_FUNCTIONS, "public.create_device", "public.list_devices", "private.current_business_ids"]) {
      expect(executable, needed).toContain(needed);
    }
  });

  it("pins search_path on every function", async () => {
    const result = await admin<{ fn: string }>(`
      select n.nspname || '.' || p.proname as fn
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private')
        and not exists (
          select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) as setting
          where setting like 'search_path=%'
        )
    `);
    expect(result.rows).toEqual([]);
  });

  it("has an index behind every foreign key", async () => {
    const result = await admin<{ table_name: string; conname: string }>(`
      select c.conrelid::regclass::text as table_name, c.conname
      from pg_constraint c join pg_namespace n on n.oid = c.connamespace
      where c.contype = 'f' and n.nspname = 'public'
        and not exists (
          select 1 from pg_index i
          where i.indrelid = c.conrelid
            and (i.indkey::smallint[])[0:cardinality(c.conkey) - 1] @> c.conkey
            and c.conkey @> (i.indkey::smallint[])[0:cardinality(c.conkey) - 1]
        )
    `);
    expect(result.rows).toEqual([]);
  });

  it("has exactly one policy per table, role and command (no overlapping permissive policies)", async () => {
    const result = await admin<{ tablename: string; cmd: string; total: number }>(`
      select tablename, cmd, count(*)::int as total
      from pg_policies where schemaname = 'public'
      group by tablename, cmd having count(*) > 1
    `);
    expect(result.rows).toEqual([]);
    const tables = await admin<{ tablename: string }>(
      "select distinct tablename from pg_policies where schemaname = 'public' order by 1",
    );
    expect(tables.rows.map((row) => row.tablename)).toEqual([...TABLES].sort());
  });
});

/* -------------------------------------------------------------------------- */

describe("profiles", () => {
  it("are created from auth.users by a trigger", async () => {
    const result = await admin<{ id: string; name: string; email: string }>(
      "select id, name, email from public.profiles order by email",
    );
    expect(result.rows).toEqual([
      { id: A, name: "Asha", email: "asha@example.com" },
      { id: B, name: "Bhavesh", email: "bhavesh@example.com" },
      { id: C, name: "Chitra", email: "chitra@example.com" },
      // No name supplied at sign-up: falls back to the mailbox name.
      { id: D, name: "dev", email: "dev@example.com" },
      { id: E, name: "Esha", email: "esha@example.com" },
    ]);
  });

  it("are created when Supabase Auth itself inserts the user", async () => {
    const id = "f1000000-0000-4000-8000-0000000000f1";
    await db.transaction(async (tx) => {
      await tx.exec("set local role supabase_auth_admin");
      await tx.query(
        "insert into auth.users (id, email, raw_user_meta_data) values ($1, 'signup@example.com', '{\"name\": \"  New Retailer  \"}')",
        [id],
      );
    });
    const profile = await admin<{ name: string; email: string }>("select name, email from public.profiles where id = $1", [id]);
    expect(profile.rows).toEqual([{ name: "New Retailer", email: "signup@example.com" }]);
    await admin("delete from auth.users where id = $1", [id]);
  });

  it("follow email changes and are removed with the account", async () => {
    const temp = "f0000000-0000-4000-8000-00000000000f";
    await admin("insert into auth.users (id, email) values ($1, 'temp@example.com')", [temp]);
    await admin("update auth.users set email = 'renamed@example.com' where id = $1", [temp]);
    expect(await scalar<string>("select email as value from public.profiles where id = $1", [temp])).toBe(
      "renamed@example.com",
    );
    await admin("delete from auth.users where id = $1", [temp]);
    expect(await scalar<number>("select count(*)::int as value from public.profiles where id = $1", [temp])).toBe(0);
  });

  it("are private: a user reads and renames only themselves", async () => {
    const visible = await run<{ id: string }>(user(A), "select id from public.profiles");
    expect(visible.rows).toEqual([{ id: A }]);

    const own = await run(user(A), "update public.profiles set name = 'Asha K' where id = $1", [A]);
    expect(own.affectedRows).toBe(1);
    const other = await run(user(A), "update public.profiles set name = 'Hacked' where id = $1", [B]);
    expect(other.affectedRows).toBe(0);
    expect(await scalar<string>("select name as value from public.profiles where id = $1", [B])).toBe("Bhavesh");

    await expect(run(user(A), "update public.profiles set email = 'x@example.com' where id = $1", [A])).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      run(user(A), "insert into public.profiles (id, name) values (gen_random_uuid(), 'Ghost')"),
    ).rejects.toThrow(/permission denied/);
    await expect(run(user(A), "delete from public.profiles where id = $1", [A])).rejects.toThrow(/permission denied/);
    await expect(run(ANON, "select id from public.profiles")).rejects.toThrow(/permission denied/);

    await admin("update public.profiles set name = 'Asha' where id = $1", [A]);
  });
});

/* -------------------------------------------------------------------------- */

interface Tenant {
  business: string;
  device: string;
  shortId: string;
  image: string;
  activity: string;
}

const alpha = {} as Tenant;
const beta = {} as Tenant;

/** A well-formed object path inside a business folder. */
function imagePath(business: string): string {
  return `${business}/${randomUUID()}.png`;
}

async function createTenant(owner: string, name: string, slug: string, reference: string): Promise<Tenant> {
  const business = (
    await run<{ id: string }>(
      user(owner),
      `insert into public.businesses (owner_id, name, slug, description, location, whatsapp_number)
       values ($1, $2, $3, 'Test shop', 'Amravati, Maharashtra', '919876543210')
       returning id`,
      [owner, name, slug],
    )
  ).rows[0].id;

  const device = (
    await run<{ id: string; short_id: string }>(
      user(owner),
      `insert into public.devices (business_id, inventory_reference, brand, model, storage_gb, colour, battery_health,
                                   condition, notes, price, show_price)
       values ($1, $2, 'Apple', 'iPhone 13', 128, 'Midnight', 87, 'good', $3, 36500, true)
       returning id, short_id`,
      [business, reference, PRIVATE_NOTE],
    )
  ).rows[0];

  const image = (
    await run<{ id: string }>(
      user(owner),
      `insert into public.device_images (device_id, business_id, image_path, sort_order, is_primary)
       values ($1, $2, $3, 0, true)
       returning id`,
      [device.id, business, imagePath(business)],
    )
  ).rows[0].id;

  const activity = (
    await run<{ id: string }>(
      user(owner),
      `insert into public.inventory_activity (business_id, device_id, action, subject, reference)
       values ($1, $2, 'device_added', 'iPhone 13 · 128 GB · Midnight', $3)
       returning id`,
      [business, device.id, reference],
    )
  ).rows[0].id;

  return { business, device: device.id, shortId: device.short_id, image, activity };
}

describe("a retailer working directly on the tables", () => {
  it("creates a business and becomes its owner in the same transaction", async () => {
    Object.assign(alpha, await createTenant(A, "Alpha Phones", "alpha-phones", "AP-0001"));

    const members = await admin<{ user_id: string; role: string }>(
      "select user_id, role from public.business_members where business_id = $1",
      [alpha.business],
    );
    expect(members.rows).toEqual([{ user_id: A, role: "owner" }]);

    const created = await admin<{ action: string; performed_by: string; performed_by_name: string }>(
      "select action, performed_by, performed_by_name from public.inventory_activity where business_id = $1 and action = 'business_created'",
      [alpha.business],
    );
    expect(created.rows).toEqual([{ action: "business_created", performed_by: A, performed_by_name: "Asha" }]);
  });

  it("adds devices, images and activity inside that business", async () => {
    expect(alpha.device).toMatch(UUID);
    expect(alpha.shortId).toMatch(/^[23456789abcdefghjkmnpqrstuvwxyz]{8}$/);

    const visible = await run<{ id: string }>(user(A), "select id from public.devices");
    expect(visible.rows).toEqual([{ id: alpha.device }]);
    const images = await run<{ id: string }>(user(A), "select id from public.device_images");
    expect(images.rows).toEqual([{ id: alpha.image }]);

    // Whoever the client claims to be, the log records the real author.
    const entry = await admin<{ performed_by: string; performed_by_name: string }>(
      "select performed_by, performed_by_name from public.inventory_activity where id = $1",
      [alpha.activity],
    );
    expect(entry.rows).toEqual([{ performed_by: A, performed_by_name: "Asha" }]);
    await expect(
      run(
        user(A),
        `insert into public.inventory_activity (business_id, action, subject, performed_by, performed_by_name)
         values ($1, 'device_added', 'Forged', $2, 'Bhavesh')`,
        [alpha.business, B],
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("keeps sold_at and updated_at truthful whatever the client sends", async () => {
    await run(user(A), "update public.devices set availability_status = 'sold' where id = $1", [alpha.device]);
    expect(await scalar<boolean>("select sold_at is not null as value from public.devices where id = $1", [alpha.device])).toBe(true);
    await run(user(A), "update public.devices set availability_status = 'available' where id = $1", [alpha.device]);
    expect(await scalar<boolean>("select sold_at is null as value from public.devices where id = $1", [alpha.device])).toBe(true);

    for (const column of ["short_id", "sold_at", "updated_at", "id", "business_id"]) {
      await expect(
        run(user(A), `update public.devices set ${column} = ${column} where id = $1`, [alpha.device]),
        column,
      ).rejects.toThrow(/permission denied/);
    }
  });

  it("cannot create a business for someone else, a demo business or a second business", async () => {
    await expect(
      run(
        user(A),
        `insert into public.businesses (owner_id, name, slug, whatsapp_number) values ($1, 'Not mine', 'not-mine', '919876543210')`,
        [B],
      ),
    ).rejects.toThrow(/row-level security/);

    await expect(
      run(
        user(A),
        `insert into public.businesses (owner_id, name, slug, whatsapp_number, is_demo) values ($1, 'Fake demo', 'fake-demo', '919876543210', true)`,
        [A],
      ),
    ).rejects.toThrow(/permission denied/);

    await expect(
      run(
        user(A),
        `insert into public.businesses (owner_id, name, slug, whatsapp_number) values ($1, 'Second shop', 'second-shop', '919876543210')`,
        [A],
      ),
    ).rejects.toThrow(/businesses_owner_id_key/);

    for (const column of ["owner_id", "is_demo", "id", "created_at"]) {
      await expect(
        run(user(A), `update public.businesses set ${column} = ${column} where id = $1`, [alpha.business]),
        column,
      ).rejects.toThrow(/permission denied/);
    }
    await expect(run(user(A), "delete from public.businesses where id = $1", [alpha.business])).rejects.toThrow(
      /permission denied/,
    );
  });

  it("is held to the data rules by the database, not just the app", async () => {
    const attempt = (column: string, value: string) =>
      run(user(A), `update public.devices set ${column} = ${value} where id = $1`, [alpha.device]);

    await expect(attempt("battery_health", "140")).rejects.toThrow(/devices_battery_range/);
    await expect(attempt("price", "-1")).rejects.toThrow(/devices_price_range/);
    await expect(attempt("condition", "'mint'")).rejects.toThrow(/devices_condition/);
    await expect(attempt("availability_status", "'gone'")).rejects.toThrow(/devices_status/);
    await expect(attempt("storage_gb", "0")).rejects.toThrow(/devices_storage_range/);

    const setBusiness = (assignment: string) =>
      run(user(A), `update public.businesses set ${assignment} where id = $1`, [alpha.business]);
    await expect(setBusiness("slug = 'Has Spaces'")).rejects.toThrow(/businesses_slug_format/);
    await expect(setBusiness("slug = 'dashboard'")).rejects.toThrow(/businesses_slug_not_reserved/);
    await expect(setBusiness("whatsapp_number = '+91 98765'")).rejects.toThrow(/businesses_whatsapp_format/);
    await expect(setBusiness(`settings = '{"coverStyle": "neon"}'`)).rejects.toThrow(/businesses_settings_valid/);
    await expect(setBusiness(`settings = '[]'`)).rejects.toThrow(/businesses_settings_valid/);
    await expect(setBusiness("logo_path = 'https://tracker.example/pixel.png'")).rejects.toThrow(
      /businesses_logo_path_owned/,
    );
  });
});

/* -------------------------------------------------------------------------- */

describe("a second retailer is isolated at the database level", () => {
  beforeAll(async () => {
    Object.assign(beta, await createTenant(B, "Beta Mobiles", "beta-mobiles", "BM-0001"));
    await run(ANON, "select public.record_storefront_event('alpha-phones', 'view')");
  });

  it("sees only its own rows in every table", async () => {
    const checks: [string, string, string][] = [
      ["businesses", "id", beta.business],
      ["business_members", "business_id", beta.business],
      ["devices", "id", beta.device],
      ["device_images", "id", beta.image],
    ];
    for (const [table, column, own] of checks) {
      const result = await run<{ value: string }>(user(B), `select ${column}::text as value from public.${table}`);
      expect(result.rows, table).toEqual([{ value: own }]);
    }

    const activity = await run<{ business_id: string }>(user(B), "select distinct business_id from public.inventory_activity");
    expect(activity.rows).toEqual([{ business_id: beta.business }]);

    // Alpha has a view counter. Beta has none and cannot see alpha's.
    expect((await run(user(B), "select 1 from public.storefront_events")).rows).toEqual([]);
    expect((await run(user(A), "select 1 from public.storefront_events")).rows).toHaveLength(1);
  });

  it("cannot read another retailer's rows even with the exact ids", async () => {
    const lookups: [string, string, string][] = [
      ["businesses", "id", alpha.business],
      ["business_members", "business_id", alpha.business],
      ["devices", "id", alpha.device],
      ["devices", "short_id", alpha.shortId],
      ["device_images", "id", alpha.image],
      ["device_images", "device_id", alpha.device],
      ["inventory_activity", "id", alpha.activity],
      ["inventory_activity", "business_id", alpha.business],
      ["storefront_events", "business_id", alpha.business],
    ];
    for (const [table, column, value] of lookups) {
      const result = await run(user(B), `select 1 from public.${table} where ${column}::text = $1`, [value]);
      expect(result.rows, `${table}.${column}`).toEqual([]);
    }
  });

  it("cannot insert into another retailer's business", async () => {
    await expect(
      run(
        user(B),
        `insert into public.devices (business_id, inventory_reference, brand, model, storage_gb, colour, condition)
         values ($1, 'X-0001', 'Apple', 'iPhone 13', 128, 'Midnight', 'good')`,
        [alpha.business],
      ),
    ).rejects.toThrow(/row-level security/);

    await expect(
      run(
        user(B),
        `insert into public.device_images (device_id, business_id, image_path)
         values ($1, $2, $3)`,
        [alpha.device, alpha.business, imagePath(alpha.business)],
      ),
    ).rejects.toThrow(/row-level security/);

    // Claiming the image for its own business does not work either: the
    // composite foreign key ties an image to a device of the same business.
    await expect(
      run(
        user(B),
        `insert into public.device_images (device_id, business_id, image_path)
         values ($1, $2, $3)`,
        [alpha.device, beta.business, imagePath(beta.business)],
      ),
    ).rejects.toThrow(/device_images_device_fk/);

    await expect(
      run(
        user(B),
        `insert into public.inventory_activity (business_id, action, subject) values ($1, 'device_added', 'Planted')`,
        [alpha.business],
      ),
    ).rejects.toThrow(/row-level security/);

    // An entry in its own log cannot point at another tenant's device.
    await expect(
      run(
        user(B),
        `insert into public.inventory_activity (business_id, device_id, action, subject) values ($1, $2, 'device_added', 'Cross link')`,
        [beta.business, alpha.device],
      ),
    ).rejects.toThrow(/inventory_activity_device_fk/);

    await expect(
      run(
        user(B),
        `insert into public.storefront_events (business_id, day, event_type, count) values ($1, current_date, 'view', 1000)`,
        [alpha.business],
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("cannot update or delete another retailer's rows", async () => {
    const noEffect: [string, unknown[]][] = [
      ["update public.businesses set name = 'Hijacked' where id = $1", [alpha.business]],
      ["update public.devices set notes = 'tampered', price = 1, show_price = false where id = $1", [alpha.device]],
      ["update public.devices set availability_status = 'sold' where business_id = $1", [alpha.business]],
      ["delete from public.devices where id = $1", [alpha.device]],
      ["delete from public.devices where business_id = $1", [alpha.business]],
      ["update public.device_images set is_primary = false where id = $1", [alpha.image]],
      ["delete from public.device_images where device_id = $1", [alpha.device]],
    ];
    for (const [sql, params] of noEffect) {
      const result = await run(user(B), sql, params);
      expect(result.affectedRows, sql).toBe(0);
    }

    const refused: [string, unknown[]][] = [
      ["delete from public.businesses where id = $1", [alpha.business]],
      ["update public.inventory_activity set subject = 'rewritten' where id = $1", [alpha.activity]],
      ["delete from public.inventory_activity where id = $1", [alpha.activity]],
      ["update public.storefront_events set count = 0 where business_id = $1", [alpha.business]],
      ["delete from public.storefront_events where business_id = $1", [alpha.business]],
    ];
    for (const [sql, params] of refused) {
      await expect(run(user(B), sql, params), sql).rejects.toThrow(/permission denied/);
    }

    const device = await admin<Row>(
      "select notes, price, show_price, availability_status from public.devices where id = $1",
      [alpha.device],
    );
    expect(device.rows).toEqual([
      { notes: PRIVATE_NOTE, price: 36500, show_price: true, availability_status: "available" },
    ]);
    expect(await scalar<string>("select name as value from public.businesses where id = $1", [alpha.business])).toBe(
      "Alpha Phones",
    );
    expect(await scalar<number>("select count(*)::int as value from public.device_images where device_id = $1", [alpha.device])).toBe(1);
    expect(
      await scalar<number>("select count as value from public.storefront_events where business_id = $1", [alpha.business]),
    ).toBe(1);
  });

  it("is refused by every private function when it names another business", async () => {
    const input = JSON.stringify(deviceInput({ inventoryReference: "X-1" }));
    const storefront = JSON.stringify({ ...businessInput("Hijacked", "hijacked"), coverStyle: "graphite" });
    const calls: [string, unknown[]][] = [
      ["select public.list_devices($1)", [alpha.business]],
      ["select public.get_device($1, $2)", [alpha.business, alpha.device]],
      ["select public.get_reference_context($1)", [alpha.business]],
      ["select public.create_device($1, $2::jsonb)", [alpha.business, input]],
      ["select public.update_device($1, $2, $3::jsonb)", [alpha.business, alpha.device, input]],
      ["select public.set_device_availability($1, $2, 'sold')", [alpha.business, alpha.device]],
      ["select public.set_device_price_visibility($1, $2, false)", [alpha.business, alpha.device]],
      ["select public.delete_device($1, $2)", [alpha.business, alpha.device]],
      ["select public.list_activity($1, 10)", [alpha.business]],
      ["select public.get_analytics($1, 7)", [alpha.business]],
      ["select public.complete_onboarding($1)", [alpha.business]],
      ["select public.update_storefront($1, $2::jsonb)", [alpha.business, storefront]],
    ];
    for (const [sql, params] of calls) {
      await expect(run(user(B), sql, params), sql).rejects.toThrow(/onhand:forbidden/);
    }
  });

  it("cannot reach another retailer's device through its own business", async () => {
    const found = await run<{ value: unknown }>(user(B), "select public.get_device($1, $2) as value", [
      beta.business,
      alpha.device,
    ]);
    expect(found.rows[0].value).toBeNull();

    const input = JSON.stringify(deviceInput({ inventoryReference: "BM-0009" }));
    const calls: [string, unknown[]][] = [
      ["select public.update_device($1, $2, $3::jsonb)", [beta.business, alpha.device, input]],
      ["select public.set_device_availability($1, $2, 'sold')", [beta.business, alpha.device]],
      ["select public.set_device_price_visibility($1, $2, false)", [beta.business, alpha.device]],
      ["select public.delete_device($1, $2)", [beta.business, alpha.device]],
    ];
    for (const [sql, params] of calls) {
      await expect(run(user(B), sql, params), sql).rejects.toThrow(/onhand:device_not_found/);
    }
    expect(await scalar<number>("select count(*)::int as value from public.devices where id = $1", [alpha.device])).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */

describe("membership and tenant boundaries", () => {
  it("does not let a user join, promote themselves in or leave a business", async () => {
    await expect(
      run(user(B), "insert into public.business_members (business_id, user_id, role) values ($1, $2, 'owner')", [
        alpha.business,
        B,
      ]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      run(user(B), "insert into public.business_members (business_id, user_id, role) values ($1, $2, 'staff')", [
        alpha.business,
        B,
      ]),
    ).rejects.toThrow(/permission denied/);
    await expect(run(user(B), "update public.business_members set role = 'owner' where user_id = $1", [B])).rejects.toThrow(
      /permission denied/,
    );
    await expect(run(user(A), "delete from public.business_members where user_id = $1", [A])).rejects.toThrow(
      /permission denied/,
    );

    const members = await admin<{ business_id: string; user_id: string }>(
      "select business_id, user_id from public.business_members where business_id in ($1, $2) order by user_id",
      [alpha.business, beta.business],
    );
    expect(members.rows).toEqual([
      { business_id: alpha.business, user_id: A },
      { business_id: beta.business, user_id: B },
    ]);
  });

  it("does not let a device or image be moved to another tenant", async () => {
    await expect(
      run(user(B), "update public.devices set business_id = $1 where id = $2", [alpha.business, beta.device]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      run(user(B), "update public.device_images set business_id = $1 where id = $2", [alpha.business, beta.image]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      run(user(B), "update public.device_images set device_id = $1 where id = $2", [alpha.device, beta.image]),
    ).rejects.toThrow(/permission denied/);
  });

  it("would still stop a tenant move if the column privilege were ever granted (policy WITH CHECK)", async () => {
    // Second line of defence. The grant lives only inside this transaction.
    const attempt = db.transaction(async (tx) => {
      await tx.exec("grant update (business_id) on public.devices to authenticated");
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: B, role: "authenticated" })]);
      await tx.exec("set local role authenticated");
      await tx.query("update public.devices set business_id = $1 where id = $2", [alpha.business, beta.device]);
    });
    await expect(attempt).rejects.toThrow(/row-level security/);
    expect(await scalar<string>("select business_id as value from public.devices where id = $1", [beta.device])).toBe(
      beta.business,
    );
    expect(
      await scalar<boolean>("select has_column_privilege('authenticated', 'public.devices', 'business_id', 'update') as value"),
    ).toBe(false);
  });

  it("limits storefront settings to owners, while staff manage inventory", async () => {
    // Staff invitations are not in the app yet. The role is added here as an
    // administrator to prove the policies already separate the two roles.
    await admin("insert into public.business_members (business_id, user_id, role) values ($1, $2, 'staff')", [
      alpha.business,
      E,
    ]);

    const devices = await run(user(E), "select 1 from public.devices where business_id = $1", [alpha.business]);
    expect(devices.rows).toHaveLength(1);
    const edit = await run(user(E), "update public.devices set warranty = '7-day shop warranty' where id = $1", [alpha.device]);
    expect(edit.affectedRows).toBe(1);

    const rename = await run(user(E), "update public.businesses set name = 'Renamed by staff' where id = $1", [alpha.business]);
    expect(rename.affectedRows).toBe(0);
    const storefront = JSON.stringify({ ...businessInput("Renamed by staff", "alpha-phones"), coverStyle: "ember" });
    await expect(
      run(user(E), "select public.update_storefront($1, $2::jsonb)", [alpha.business, storefront]),
    ).rejects.toThrow(/onhand:forbidden/);
    expect(await scalar<string>("select name as value from public.businesses where id = $1", [alpha.business])).toBe(
      "Alpha Phones",
    );

    await admin("delete from public.business_members where business_id = $1 and user_id = $2", [alpha.business, E]);
    expect((await run(user(E), "select 1 from public.devices")).rows).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */

describe("storefront visitors (anon)", () => {
  const shopKeys = [
    "bannerPath",
    "coverStyle",
    "description",
    "hours",
    "instagramHandle",
    "isDemo",
    "location",
    "logoPath",
    "name",
    "phoneNumber",
    "slug",
    "whatsappNumber",
  ];
  const deviceKeys = [
    "accessories",
    "addedAt",
    "availability",
    "batteryHealth",
    "brand",
    "colour",
    "condition",
    "cosmeticCondition",
    "functionalCondition",
    "id",
    "images",
    "model",
    "price",
    "reference",
    "storageGb",
    "warranty",
  ];

  type PublicRow = { id: string; reference: string; price: number | null; availability: string } & Row;

  async function listPublic(slug: string): Promise<PublicRow[]> {
    const result = await run<{ value: PublicRow[] }>(ANON, "select public.list_public_devices($1) as value", [slug]);
    return result.rows[0].value;
  }

  let hidden: { id: string; shortId: string };
  let sold: { id: string; shortId: string };

  beforeAll(async () => {
    const insert = async (reference: string, price: number, showPrice: boolean, status: string) =>
      (
        await run<{ id: string; short_id: string }>(
          user(A),
          `insert into public.devices (business_id, inventory_reference, brand, model, storage_gb, colour, condition, notes,
                                       price, show_price, availability_status)
           values ($1, $2, 'Samsung', 'Galaxy S23 Ultra', 256, 'Green', 'excellent', $3, $4, $5, $6)
           returning id, short_id`,
          [alpha.business, reference, PRIVATE_NOTE, price, showPrice, status],
        )
      ).rows[0];
    const hiddenRow = await insert("AP-0002", 58123, false, "available");
    const soldRow = await insert("AP-0003", 46321, true, "sold");
    hidden = { id: hiddenRow.id, shortId: hiddenRow.short_id };
    sold = { id: soldRow.id, shortId: soldRow.short_id };
  });

  it("cannot read or write any base table", async () => {
    for (const table of TABLES) {
      await expect(run(ANON, `select * from public.${table} limit 1`), table).rejects.toThrow(/permission denied/);
      await expect(run(ANON, `delete from public.${table}`), table).rejects.toThrow(/permission denied/);
    }
    await expect(
      run(ANON, "update public.devices set show_price = true, availability_status = 'available'"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      run(
        ANON,
        `insert into public.devices (business_id, inventory_reference, brand, model, storage_gb, colour, condition)
         values ($1, 'ANON-1', 'Apple', 'iPhone 13', 128, 'Midnight', 'good')`,
        [alpha.business],
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("cannot call any private function", async () => {
    const calls: [string, unknown[]][] = [
      ["select public.get_my_profile()", []],
      ["select public.get_my_business()", []],
      ["select public.is_slug_available('anything')", []],
      ["select public.list_devices($1)", [alpha.business]],
      ["select public.get_device($1, $2)", [alpha.business, alpha.device]],
      ["select public.delete_device($1, $2)", [alpha.business, alpha.device]],
      ["select public.list_activity($1, 10)", [alpha.business]],
      ["select public.get_analytics($1, 7)", [alpha.business]],
      ["select private.current_business_ids()", []],
      ["select private.device_label('Apple', 'iPhone 13', 128, 'Midnight')", []],
    ];
    for (const [sql, params] of calls) {
      await expect(run(ANON, sql, params), sql).rejects.toThrow(/permission denied/);
    }
  });

  it("gets a shop with public fields only", async () => {
    const result = await run<{ value: Row }>(ANON, "select public.get_public_shop('alpha-phones') as value");
    const shop = result.rows[0].value;
    expect(Object.keys(shop).sort()).toEqual(shopKeys);
    expect(shop).toMatchObject({ name: "Alpha Phones", slug: "alpha-phones", coverStyle: "graphite", hours: null, isDemo: false });

    const payload = JSON.stringify(shop);
    expect(payload).not.toContain(A);
    expect(payload).not.toContain(alpha.business);
    expect(payload).not.toContain("settings");
    expect(payload).not.toContain("owner");
  });

  it("gets devices with public fields only: no notes, no internal ids, no hidden price", async () => {
    const devices = await listPublic("alpha-phones");
    expect(devices.map((device) => device.reference).sort()).toEqual(["AP-0001", "AP-0002", "AP-0003"]);
    for (const device of devices) {
      expect(Object.keys(device).sort()).toEqual(deviceKeys);
      expect(device.addedAt).toMatch(ISO);
    }

    const byReference = Object.fromEntries(devices.map((device) => [device.reference, device]));
    expect(byReference["AP-0001"]).toMatchObject({ id: alpha.shortId, price: 36500, availability: "available" });
    // Price is private while show_price is false...
    expect(byReference["AP-0002"]).toMatchObject({ id: hidden.shortId, price: null, availability: "available" });
    // ...and once a phone is sold, even if it was public before.
    expect(byReference["AP-0003"]).toMatchObject({ id: sold.shortId, price: null, availability: "sold" });

    const detail = await run<{ value: Row }>(ANON, "select public.get_public_device('alpha-phones', $1) as value", [
      hidden.shortId,
    ]);
    const payload = JSON.stringify(devices) + JSON.stringify(detail.rows[0].value);
    expect(detail.rows[0].value).toMatchObject({ reference: "AP-0002", price: null });
    for (const secret of [PRIVATE_NOTE, "notes", "58123", "46321", "showPrice", "show_price", alpha.device, hidden.id, sold.id, A]) {
      expect(payload, secret).not.toContain(secret);
    }

    // The one identifier a visitor can see is the shop's own storage folder,
    // inside its photo paths. It appears nowhere else, and never another shop's.
    const withoutImages = JSON.stringify(devices.map((device) => ({ ...device, images: [] })));
    expect(withoutImages).not.toContain(alpha.business);
    const paths = devices.flatMap((device) => (device.images as { path: string }[]).map((image) => image.path));
    expect(paths).toHaveLength(1);
    expect(paths.every((objectPath) => objectPath.startsWith(`${alpha.business}/`))).toBe(true);
    expect(payload).not.toContain(beta.business);
  });

  it("lists available phones first and sold phones last", async () => {
    const order = (await listPublic("alpha-phones")).map((device) => device.availability);
    expect(order).toEqual(["available", "available", "sold"]);
  });

  it("leaves sold phones out entirely when the shop hides them", async () => {
    await run(
      user(A),
      `update public.businesses set settings = settings || '{"showSoldDevices": false}'::jsonb where id = $1`,
      [alpha.business],
    );
    expect((await listPublic("alpha-phones")).map((device) => device.reference).sort()).toEqual(["AP-0001", "AP-0002"]);
    const direct = await run<{ value: unknown }>(ANON, "select public.get_public_device('alpha-phones', $1) as value", [
      sold.shortId,
    ]);
    expect(direct.rows[0].value).toBeNull();

    await run(
      user(A),
      `update public.businesses set settings = settings || '{"showSoldDevices": true}'::jsonb where id = $1`,
      [alpha.business],
    );
    expect(await listPublic("alpha-phones")).toHaveLength(3);
  });

  it("never mixes one shop's inventory into another's", async () => {
    const alphaList = await listPublic("alpha-phones");
    const betaList = await listPublic("beta-mobiles");
    expect(betaList.map((device) => device.reference)).toEqual(["BM-0001"]);
    expect(alphaList.some((device) => device.reference.startsWith("BM-"))).toBe(false);

    // A device id from one shop does not resolve under another shop's address.
    const crossed = await run<{ value: unknown }>(ANON, "select public.get_public_device('beta-mobiles', $1) as value", [
      alpha.shortId,
    ]);
    expect(crossed.rows[0].value).toBeNull();
  });

  it("gets nothing for a storefront that does not exist", async () => {
    const shop = await run<{ value: unknown }>(ANON, "select public.get_public_shop('no-such-shop') as value");
    expect(shop.rows[0].value).toBeNull();
    expect(await listPublic("no-such-shop")).toEqual([]);
    const device = await run<{ value: unknown }>(ANON, "select public.get_public_device('no-such-shop', 'abc') as value");
    expect(device.rows[0].value).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */

describe("record_storefront_event", () => {
  const counters = () =>
    admin<{ slug: string; event_type: string; device_short_id: string; count: number }>(`
      select b.slug, e.event_type, e.device_short_id, e.count
      from public.storefront_events e join public.businesses b on b.id = e.business_id
      order by b.slug, e.event_type, e.device_short_id
    `);

  it("lets visitors count views and inquiries, one bounded row per day and device", async () => {
    await admin("delete from public.storefront_events");

    for (let i = 0; i < 5; i++) await run(ANON, "select public.record_storefront_event('alpha-phones', 'view')");
    await run(ANON, "select public.record_storefront_event('alpha-phones', 'inquiry', $1)", [alpha.shortId]);
    await run(ANON, "select public.record_storefront_event('alpha-phones', 'inquiry', $1)", [alpha.shortId]);
    await run(ANON, "select public.record_storefront_event('alpha-phones', 'inquiry')");
    await run(user(B), "select public.record_storefront_event('beta-mobiles', 'view')");

    expect((await counters()).rows).toEqual([
      { slug: "alpha-phones", event_type: "inquiry", device_short_id: "", count: 1 },
      { slug: "alpha-phones", event_type: "inquiry", device_short_id: alpha.shortId, count: 2 },
      { slug: "alpha-phones", event_type: "view", device_short_id: "", count: 5 },
      { slug: "beta-mobiles", event_type: "view", device_short_id: "", count: 1 },
    ]);
    expect(await scalar<string>("select to_char(max(day), 'YYYY-MM-DD') as value from public.storefront_events")).toBe(
      istDay(Date.now()),
    );
  });

  it("cannot be used to write anything else", async () => {
    const before = (await counters()).rows;

    // Unknown shop, unknown event type, missing values: all ignored.
    await run(ANON, "select public.record_storefront_event('no-such-shop', 'view')");
    await run(ANON, "select public.record_storefront_event('alpha-phones', 'purchase')");
    await run(ANON, "select public.record_storefront_event('alpha-phones', null)");
    await run(ANON, "select public.record_storefront_event(null, 'view')");
    await run(ANON, `select public.record_storefront_event('alpha-phones''; drop table public.devices; --', 'view')`);
    expect((await counters()).rows).toEqual(before);

    // A device that is not this shop's is never attributed: the tap is counted
    // as a general inquiry and no arbitrary text is stored.
    await run(ANON, "select public.record_storefront_event('alpha-phones', 'inquiry', $1)", [beta.shortId]);
    await run(ANON, "select public.record_storefront_event('alpha-phones', 'inquiry', $1)", ["x".repeat(5000)]);
    await run(ANON, "select public.record_storefront_event('alpha-phones', 'view', $1)", [alpha.shortId]);

    const after = (await counters()).rows;
    expect(after).toEqual([
      { slug: "alpha-phones", event_type: "inquiry", device_short_id: "", count: 3 },
      { slug: "alpha-phones", event_type: "inquiry", device_short_id: alpha.shortId, count: 2 },
      { slug: "alpha-phones", event_type: "view", device_short_id: "", count: 6 },
      { slug: "beta-mobiles", event_type: "view", device_short_id: "", count: 1 },
    ]);
    expect(await scalar<number>("select count(*)::int as value from public.devices")).toBeGreaterThan(0);
  });

  it("leaves the counters unreadable and unwritable for visitors, and private between retailers", async () => {
    await expect(run(ANON, "select * from public.storefront_events")).rejects.toThrow(/permission denied/);
    await expect(
      run(ANON, "insert into public.storefront_events (business_id, day, event_type, count) values ($1, current_date, 'view', 99)", [
        alpha.business,
      ]),
    ).rejects.toThrow(/permission denied/);
    await expect(run(ANON, "update public.storefront_events set count = 0")).rejects.toThrow(/permission denied/);
    await expect(run(user(A), "update public.storefront_events set count = 0")).rejects.toThrow(/permission denied/);

    const mine = await run<{ value: { totalViews: number; totalInquiries: number; inquiriesByDevice: Record<string, number>; days: unknown[] } }>(
      user(A),
      "select public.get_analytics($1, 7) as value",
      [alpha.business],
    );
    expect(mine.rows[0].value).toMatchObject({
      totalViews: 6,
      totalInquiries: 5,
      inquiriesByDevice: { [alpha.shortId]: 2 },
    });
    expect(mine.rows[0].value.days).toHaveLength(7);

    const theirs = await run<{ value: { totalViews: number } }>(user(B), "select public.get_analytics($1, 7) as value", [
      beta.business,
    ]);
    expect(theirs.rows[0].value.totalViews).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */

describe("storage policies (0002_storage.sql, against a stand-in for Supabase's storage schema)", () => {
  // The real storage schema only exists on Supabase. This reproduces the parts
  // the migration touches (buckets, objects, storage.foldername) so the policy
  // logic and syntax are exercised. Supabase Storage itself is not.
  const STORAGE_SHIM = `
    create schema storage;
    create table storage.buckets (
      id text primary key,
      name text not null,
      public boolean default false,
      file_size_limit bigint,
      allowed_mime_types text[]
    );
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text references storage.buckets (id),
      name text,
      owner uuid,
      created_at timestamptz default now()
    );
    alter table storage.objects enable row level security;

    -- Same body as Supabase's helper.
    create function storage.foldername(name text) returns text[] language plpgsql as $$
    declare _parts text[];
    begin
      select string_to_array(name, '/') into _parts;
      return _parts[1:array_length(_parts, 1) - 1];
    end $$;

    grant usage on schema storage to anon, authenticated, service_role;
    grant all on storage.objects, storage.buckets to anon, authenticated, service_role;
    insert into storage.buckets (id, name, public) values ('other-bucket', 'other-bucket', true);
  `;
  const STORAGE_MIGRATION = fs.readFileSync(path.join(ROOT, "supabase/migrations/0002_storage.sql"), "utf8");

  const upload = (identity: Identity, name: string, bucket = "device-images") =>
    run(identity, "insert into storage.objects (bucket_id, name) values ($1, $2)", [bucket, name]);

  let alphaObject: string;

  beforeAll(async () => {
    await db.exec(STORAGE_SHIM);
    await db.exec(STORAGE_MIGRATION);
    await db.exec(STORAGE_MIGRATION);
  });

  it("creates one public bucket limited to 6 MB images", async () => {
    const bucket = await admin<Row>(
      "select public, file_size_limit::int as file_size_limit, allowed_mime_types from storage.buckets where id = 'device-images'",
    );
    expect(bucket.rows).toEqual([
      { public: true, file_size_limit: 6291456, allowed_mime_types: ["image/jpeg", "image/png", "image/webp"] },
    ]);
  });

  it("lets a retailer upload only into their own business folder", async () => {
    alphaObject = imagePath(alpha.business);
    await expect(upload(user(A), alphaObject)).resolves.toMatchObject({ affectedRows: 1 });
    await expect(upload(user(A), `${alpha.business}/${randomUUID()}.webp`)).resolves.toMatchObject({ affectedRows: 1 });

    const refused = [
      imagePath(beta.business),
      `${alpha.business}/evil.svg`,
      `${alpha.business}/${randomUUID()}.svg`,
      `${alpha.business}/nested/${randomUUID()}.png`,
      `${alpha.business}/../${beta.business}/${randomUUID()}.png`,
      `${randomUUID()}.png`,
      `${randomUUID()}/${randomUUID()}.png`,
    ];
    for (const name of refused) {
      await expect(upload(user(A), name), name).rejects.toThrow(/row-level security/);
    }
    await expect(upload(user(A), imagePath(alpha.business), "other-bucket")).rejects.toThrow(/row-level security/);
    await expect(upload(user(B), imagePath(alpha.business))).rejects.toThrow(/row-level security/);
    await expect(upload(ANON, imagePath(alpha.business))).rejects.toThrow(/row-level security/);
  });

  it("uses exactly the path shape the driver uploads to", async () => {
    const { data, storage } = driverFor(user(A));
    const saved = await data.saveImage(A, alpha.business, {
      bytes: Uint8Array.from([0x89, 0x50, 0x4e, 0x47]),
      contentType: "image/jpeg",
    });
    const [objectPath] = [...storage.files.keys()];
    expect(saved.url).toBe(`${PUBLIC_BASE}${objectPath}`);
    await expect(upload(user(A), objectPath)).resolves.toMatchObject({ affectedRows: 1 });
    expect(await scalar<boolean>("select private.owns_image_path($1::uuid, $2) as value", [alpha.business, objectPath])).toBe(true);
  });

  it("keeps each folder private to its members for listing and deleting", async () => {
    await upload(user(B), imagePath(beta.business));

    const mine = await run<{ name: string }>(user(A), "select name from storage.objects");
    expect(mine.rows.length).toBeGreaterThanOrEqual(3);
    expect(mine.rows.every((row) => row.name.startsWith(`${alpha.business}/`))).toBe(true);

    expect((await run(user(B), "select 1 from storage.objects where name = $1", [alphaObject])).rows).toEqual([]);
    expect((await run(ANON, "select 1 from storage.objects")).rows).toEqual([]);
    expect((await run(user(B), "delete from storage.objects where name = $1", [alphaObject])).affectedRows).toBe(0);
    expect((await run(ANON, "delete from storage.objects")).affectedRows).toBe(0);
    expect((await run(user(B), "update storage.objects set name = $1 where name = $2", [imagePath(beta.business), alphaObject])).affectedRows).toBe(0);

    expect((await run(user(A), "delete from storage.objects where name = $1", [alphaObject])).affectedRows).toBe(1);
    expect(await scalar<number>("select count(*)::int as value from storage.objects where name like $1", [`${beta.business}/%`])).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */

describe("the Supabase driver, run against the real SQL and policies", () => {
  const gammaInput = businessInput("Gamma Phones", "gamma-phones");
  const chitra = driverFor(user(C));
  const dev = driverFor(user(D));
  let businessId: string;
  const deviceIds: string[] = [];

  it("reads the signed-in user's profile", async () => {
    const profile = await chitra.data.account.getProfile();
    expect(profile).toMatchObject({ id: C, name: "Chitra", email: "chitra@example.com" });
    expect(profile?.createdAt).toMatch(ISO);
    expect((await chitra.data.account.updateProfile("  Chitra Rao  ")).name).toBe("Chitra Rao");
    expect((await chitra.data.account.updateProfile("Chitra")).name).toBe("Chitra");
    expect(await driverFor(ANON).data.account.getProfile().catch((error: unknown) => error)).toBeInstanceOf(AppError);

    // Profile and business arrive together; there is no business yet.
    expect(await chitra.data.account.getContext()).toEqual({ profile, business: null });
  });

  it("creates a business with a unique storefront address", async () => {
    expect(await chitra.data.getBusinessForUser(C)).toBeNull();
    expect(await chitra.data.isSlugAvailable("gamma-phones")).toBe(true);
    expect(await chitra.data.isSlugAvailable("alpha-phones")).toBe(false);
    expect(await chitra.data.isSlugAvailable("dashboard")).toBe(false);

    const business = await chitra.data.createBusiness(C, gammaInput);
    businessId = business.id;
    expect(Object.keys(business).sort()).toEqual([
      "bannerUrl",
      "createdAt",
      "description",
      "id",
      "instagramHandle",
      "isDemo",
      "location",
      "logoUrl",
      "name",
      "ownerId",
      "phoneNumber",
      "settings",
      "slug",
      "whatsappNumber",
    ]);
    expect(business).toMatchObject({
      ownerId: C,
      name: "Gamma Phones",
      slug: "gamma-phones",
      isDemo: false,
      logoUrl: null,
      bannerUrl: null,
      settings: {
        showPricesByDefault: true,
        showSoldDevices: true,
        coverStyle: "graphite",
        hours: null,
        onboardingCompletedAt: null,
      },
    });
    expect(business.createdAt).toMatch(ISO);

    expect(await chitra.data.isSlugAvailable("gamma-phones")).toBe(false);
    expect(await chitra.data.isSlugAvailable("gamma-phones", businessId)).toBe(true);
    expect((await chitra.data.getBusinessForUser(C))?.id).toBe(businessId);
    expect((await chitra.data.getPublicShop("gamma-phones"))?.name).toBe("Gamma Phones");

    const context = await chitra.data.account.getContext();
    expect(context.profile?.id).toBe(C);
    expect(context.business).toEqual(await chitra.data.getBusinessForUser(C));
    // Another signed-in user gets their own (empty) context, never this one.
    expect((await dev.data.account.getContext()).business).toBeNull();
  });

  it("rejects a taken or reserved address and a second storefront with the app's own errors", async () => {
    const taken = await appError(dev.data.createBusiness(D, businessInput("Copycat", "gamma-phones")));
    expect(taken.code).toBe("conflict");
    expect(taken.message).toBe("That storefront address is already taken.");
    expect(taken.fieldErrors).toEqual({ slug: "That storefront address is already taken." });

    const reserved = await appError(dev.data.createBusiness(D, businessInput("Reserved", "dashboard")));
    expect(reserved.fieldErrors).toEqual({ slug: "That storefront address is already taken." });
    expect(await dev.data.getBusinessForUser(D)).toBeNull();

    const second = await appError(chitra.data.createBusiness(C, businessInput("Second", "second-gamma")));
    expect(second.code).toBe("conflict");
    expect(second.message).toBe("Your account already has a storefront.");

    const signedOut = await appError(driverFor(ANON).data.createBusiness(C, businessInput("Nobody", "nobody-shop")));
    expect(signedOut.code).toBe("forbidden");
  });

  it("adds three devices that appear on the public storefront", async () => {
    expect(await chitra.data.suggestReference(C, businessId)).toBe("GP-0001");

    const first = await chitra.data.createDevice(C, businessId, deviceInput({ inventoryReference: "GP-0001" }));
    expect(Object.keys(first).sort()).toEqual([
      "accessories",
      "availabilityStatus",
      "batteryHealth",
      "brand",
      "businessId",
      "colour",
      "condition",
      "cosmeticCondition",
      "createdAt",
      "functionalCondition",
      "id",
      "images",
      "inventoryReference",
      "model",
      "notes",
      "price",
      "shortId",
      "showPrice",
      "soldAt",
      "storageGb",
      "updatedAt",
      "warranty",
    ]);
    expect(first).toMatchObject({
      businessId,
      inventoryReference: "GP-0001",
      accessories: ["Charging cable"],
      notes: PRIVATE_NOTE,
      price: 36500,
      showPrice: true,
      availabilityStatus: "available",
      images: [],
      soldAt: null,
    });
    expect(first.id).toMatch(UUID);
    expect(first.shortId).toMatch(/^[23456789abcdefghjkmnpqrstuvwxyz]{8}$/);
    expect(first.createdAt).toMatch(ISO);
    deviceIds.push(first.id);

    deviceIds.push(
      (
        await chitra.data.createDevice(
          C,
          businessId,
          deviceInput({
            inventoryReference: "GP-0002",
            brand: "Samsung",
            model: "Galaxy S23 Ultra",
            storageGb: 256,
            colour: "Green",
            batteryHealth: null,
            price: 58000,
          }),
        )
      ).id,
    );
    deviceIds.push(
      (
        await chitra.data.createDevice(
          C,
          businessId,
          deviceInput({ inventoryReference: "GP-0003", model: "iPhone 14 Pro", storageGb: 256, colour: "Deep Purple" }),
        )
      ).id,
    );
    expect(await chitra.data.suggestReference(C, businessId)).toBe("GP-0004");

    const listed = await chitra.data.listPublicDevices("gamma-phones");
    expect(listed.map((device) => device.reference).sort()).toEqual(["GP-0001", "GP-0002", "GP-0003"]);
    expect(listed.every((device) => device.availability === "available")).toBe(true);
    expect((await chitra.data.listDevices(C, businessId)).map((device) => device.inventoryReference)).toEqual([
      "GP-0003",
      "GP-0002",
      "GP-0001",
    ]);
  });

  it("honours the date added: today means now, an earlier day means noon IST", async () => {
    const backdated = await chitra.data.createDevice(
      C,
      businessId,
      deviceInput({ inventoryReference: "GP-0050", addedOn: "2020-01-15" }),
    );
    expect(backdated.createdAt).toBe(istDayToIso("2020-01-15"));

    const unchanged = await chitra.data.updateDevice(
      C,
      businessId,
      backdated.id,
      deviceInput({ inventoryReference: "GP-0050", addedOn: "2020-01-15", warranty: "No warranty" }),
    );
    expect(unchanged.createdAt).toBe(backdated.createdAt);

    const moved = await chitra.data.updateDevice(
      C,
      businessId,
      backdated.id,
      deviceInput({ inventoryReference: "GP-0050", addedOn: "2021-06-30" }),
    );
    expect(moved.createdAt).toBe(istDayToIso("2021-06-30"));

    const today = await chitra.data.getDevice(C, businessId, deviceIds[0]);
    expect(Math.abs(Date.now() - new Date(today!.createdAt).getTime())).toBeLessThan(5 * 60 * 1000);
    await chitra.data.deleteDevice(C, businessId, backdated.id);
  });

  it("treats two identical phones as separate inventory records", async () => {
    const twin = await chitra.data.createDevice(C, businessId, deviceInput({ inventoryReference: "GP-0004", batteryHealth: 93 }));
    const sameSpec = (await chitra.data.listPublicDevices("gamma-phones")).filter(
      (device) => device.model === "iPhone 13" && device.storageGb === 128,
    );
    expect(sameSpec).toHaveLength(2);
    expect(new Set(sameSpec.map((device) => device.batteryHealth))).toEqual(new Set([87, 93]));
    expect(new Set(sameSpec.map((device) => device.id)).size).toBe(2);
    await chitra.data.deleteDevice(C, businessId, twin.id);
  });

  it("requires a unique inventory reference within a business, ignoring case", async () => {
    const error = await appError(chitra.data.createDevice(C, businessId, deviceInput({ inventoryReference: "gp-0001" })));
    expect(error.code).toBe("conflict");
    expect(error.message).toBe("Another device already uses this reference.");
    expect(error.fieldErrors).toEqual({ inventoryReference: "Another device already uses this reference." });

    const onEdit = await appError(
      chitra.data.updateDevice(C, businessId, deviceIds[1], deviceInput({ inventoryReference: "GP-0001" })),
    );
    expect(onEdit.fieldErrors).toEqual({ inventoryReference: "Another device already uses this reference." });
    expect((await chitra.data.getDevice(C, businessId, deviceIds[1]))?.inventoryReference).toBe("GP-0002");
  });

  it("marks a device sold and the storefront reflects it immediately", async () => {
    const [first] = deviceIds;
    const sold = await chitra.data.setAvailability(C, businessId, first, "sold");
    expect(sold.availabilityStatus).toBe("sold");
    expect(sold.soldAt).toMatch(ISO);

    const list = await chitra.data.listPublicDevices("gamma-phones");
    const publicDevice = list.find((device) => device.reference === "GP-0001");
    expect(publicDevice?.availability).toBe("sold");
    expect(publicDevice?.price).toBeNull();
    const order = list.map((device) => device.availability);
    expect(order.indexOf("sold")).toBe(order.length - 1);

    const restored = await chitra.data.setAvailability(C, businessId, first, "available");
    expect(restored.soldAt).toBeNull();
    expect((await chitra.data.setAvailability(C, businessId, first, "reserved")).availabilityStatus).toBe("reserved");
    await chitra.data.setAvailability(C, businessId, first, "available");
  });

  it("hides sold devices entirely when the shop chooses to", async () => {
    const [first] = deviceIds;
    await chitra.data.setAvailability(C, businessId, first, "sold");
    const hiding = await chitra.data.updateStorefront(C, businessId, storefrontInput(gammaInput, { showSoldDevices: false }));
    expect(hiding.settings.showSoldDevices).toBe(false);

    expect((await chitra.data.listPublicDevices("gamma-phones")).some((device) => device.reference === "GP-0001")).toBe(false);
    const shortId = (await chitra.data.getDevice(C, businessId, first))!.shortId;
    expect(await chitra.data.getPublicDevice("gamma-phones", shortId)).toBeNull();

    await chitra.data.updateStorefront(C, businessId, storefrontInput(gammaInput, { showSoldDevices: true }));
    await chitra.data.setAvailability(C, businessId, first, "available");
    expect((await chitra.data.getPublicDevice("gamma-phones", shortId))?.availability).toBe("available");
  });

  it("never exposes a hidden price, internal notes or internal ids publicly", async () => {
    const [, second] = deviceIds;
    const before = (await chitra.data.listPublicDevices("gamma-phones")).find((device) => device.reference === "GP-0002");
    expect(before?.price).toBe(58000);

    const hiddenDevice = await chitra.data.setPriceVisibility(C, businessId, second, false);
    expect(hiddenDevice.showPrice).toBe(false);

    const shortId = hiddenDevice.shortId;
    const publicDevice = await chitra.data.getPublicDevice("gamma-phones", shortId);
    expect(publicDevice?.price).toBeNull();
    expect(Object.keys(publicDevice!).sort()).toEqual([
      "accessories",
      "addedAt",
      "availability",
      "batteryHealth",
      "brand",
      "colour",
      "condition",
      "cosmeticCondition",
      "functionalCondition",
      "id",
      "images",
      "model",
      "price",
      "reference",
      "storageGb",
      "warranty",
    ]);

    const list = JSON.stringify(await chitra.data.listPublicDevices("gamma-phones"));
    const detail = JSON.stringify(publicDevice);
    const shop = await chitra.data.getPublicShop("gamma-phones");
    for (const payload of [list, detail]) {
      expect(payload).not.toContain("58000");
      expect(payload).not.toContain(PRIVATE_NOTE);
      expect(payload).not.toContain("notes");
      expect(payload).not.toContain("showPrice");
      expect(payload).not.toContain(businessId);
      for (const id of deviceIds) expect(payload).not.toContain(id);
    }
    expect(Object.keys(shop!).sort()).toEqual([
      "bannerUrl",
      "coverStyle",
      "description",
      "hours",
      "instagramHandle",
      "isDemo",
      "location",
      "logoUrl",
      "name",
      "phoneNumber",
      "slug",
      "whatsappNumber",
    ]);
    expect(JSON.stringify(shop)).not.toContain(C);
    expect(JSON.stringify(shop)).not.toContain(businessId);

    // The owner still sees the price in the dashboard.
    expect((await chitra.data.getDevice(C, businessId, second))?.price).toBe(58000);
  });

  it("edits and deletes devices", async () => {
    const [, , third] = deviceIds;
    const edited = await chitra.data.updateDevice(
      C,
      businessId,
      third,
      deviceInput({
        inventoryReference: "GP-0003",
        model: "iPhone 14 Pro Max",
        storageGb: 512,
        colour: "Gold",
        price: 71000,
        accessories: ["Original box", "Charging cable"],
        availabilityStatus: "reserved",
        showPrice: false,
      }),
    );
    expect(edited).toMatchObject({
      model: "iPhone 14 Pro Max",
      storageGb: 512,
      accessories: ["Original box", "Charging cable"],
      availabilityStatus: "reserved",
      showPrice: false,
    });
    expect(new Date(edited.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(edited.createdAt).getTime());
    expect((await chitra.data.listPublicDevices("gamma-phones")).find((device) => device.reference === "GP-0003")?.storageGb).toBe(512);

    await chitra.data.deleteDevice(C, businessId, third);
    expect(await chitra.data.getDevice(C, businessId, third)).toBeNull();
    expect((await chitra.data.listPublicDevices("gamma-phones")).some((device) => device.reference === "GP-0003")).toBe(false);

    const gone = await appError(chitra.data.deleteDevice(C, businessId, third));
    expect(gone.code).toBe("not_found");
    expect(gone.message).toBe("That device is no longer in your inventory.");
  });

  it("treats an id that is not a uuid as a device that is not there", async () => {
    // A mistyped link or a tampered request. Postgres would answer with a
    // syntax error; the demo driver answers "not found", so this one must too.
    for (const id of ["not-a-uuid", "' or 1=1 --", "", "123", `${deviceIds[0]}x`]) {
      expect(await chitra.data.getDevice(C, businessId, id), id).toBeNull();

      const attempts = [
        chitra.data.updateDevice(C, businessId, id, deviceInput({ inventoryReference: "GP-0099" })),
        chitra.data.setAvailability(C, businessId, id, "sold"),
        chitra.data.setPriceVisibility(C, businessId, id, false),
        chitra.data.deleteDevice(C, businessId, id),
      ];
      for (const attempt of attempts) {
        const error = await appError(attempt);
        expect(error.code, id).toBe("not_found");
        expect(error.message, id).toBe("That device is no longer in your inventory.");
      }
    }
    // Nothing was touched along the way.
    expect((await chitra.data.getDevice(C, businessId, deviceIds[0]))?.id).toBe(deviceIds[0]);
  });

  it("rejects image urls that were not uploaded by this business", async () => {
    const foreign = [
      "https://tracker.example/pixel.png",
      `${PUBLIC_BASE}${alpha.business}/11111111-1111-4111-8111-111111111111.png`,
      `${PUBLIC_BASE}${businessId}/../${alpha.business}/11111111-1111-4111-8111-111111111111.png`,
      `${PUBLIC_BASE}${businessId}/not-a-uuid.png`,
    ];
    for (const url of foreign) {
      const error = await appError(
        chitra.data.createDevice(C, businessId, deviceInput({ inventoryReference: "GP-0099", images: [{ url, isPrimary: true }] })),
      );
      expect(error.code, url).toBe("validation");
      expect(error.fieldErrors).toEqual({ images: "One of the photos could not be attached. Please upload it again." });
    }
    // A failed write leaves no partial record behind.
    expect((await chitra.data.listDevices(C, businessId)).some((device) => device.inventoryReference === "GP-0099")).toBe(false);

    // The database refuses on its own as well, if the driver's check were bypassed.
    const input = JSON.stringify(
      deviceInput({ inventoryReference: "GP-0098" }),
    ).replace('"images":[]', `"images":[{"path":"${alpha.business}/11111111-1111-4111-8111-111111111111.png","isPrimary":true}]`);
    await expect(run(user(C), "select public.create_device($1, $2::jsonb)", [businessId, input])).rejects.toThrow(
      /onhand:image_not_owned/,
    );
    expect((await chitra.data.listDevices(C, businessId)).some((device) => device.inventoryReference === "GP-0098")).toBe(false);
  });

  it("stores uploaded images, attaches them and cleans up after itself", async () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const first = await chitra.data.saveImage(C, businessId, { bytes: png, contentType: "image/png" });
    const second = await chitra.data.saveImage(C, businessId, { bytes: png, contentType: "image/webp" });
    const third = await chitra.data.saveImage(C, businessId, { bytes: png, contentType: "image/jpeg" });
    expect(first.url).toMatch(new RegExp(`^${PUBLIC_BASE}${businessId}/[0-9a-f-]{36}\\.png$`));
    expect(second.url.endsWith(".webp")).toBe(true);
    expect(third.url.endsWith(".jpg")).toBe(true);
    expect(chitra.storage.files.size).toBe(3);

    const device = await chitra.data.createDevice(
      C,
      businessId,
      deviceInput({
        inventoryReference: "GP-0010",
        images: [
          { url: first.url, isPrimary: false },
          { url: second.url, isPrimary: true },
        ],
      }),
    );
    expect(device.images.map((image) => image.url)).toEqual([first.url, second.url]);
    expect(device.images.map((image) => image.sortOrder)).toEqual([0, 1]);
    expect(device.images.filter((image) => image.isPrimary).map((image) => image.url)).toEqual([second.url]);
    expect((await chitra.data.getPublicDevice("gamma-phones", device.shortId))?.images).toEqual([
      { url: second.url, isPrimary: true },
      { url: first.url, isPrimary: false },
    ]);

    // Reorder, drop one, add one, and let the first become primary by default.
    const firstImageId = device.images[0].id;
    const updated = await chitra.data.updateDevice(
      C,
      businessId,
      device.id,
      deviceInput({
        inventoryReference: "GP-0010",
        images: [
          { url: third.url, isPrimary: false },
          { url: first.url, isPrimary: false },
        ],
      }),
    );
    expect(updated.images.map((image) => image.url)).toEqual([third.url, first.url]);
    expect(updated.images.map((image) => image.isPrimary)).toEqual([true, false]);
    // Kept photos keep their identity.
    expect(updated.images[1].id).toBe(firstImageId);
    const secondPath = second.url.slice(PUBLIC_BASE.length);
    expect(chitra.storage.removed).toEqual([secondPath]);

    await chitra.data.deleteDevice(C, businessId, device.id);
    expect(chitra.storage.removed.sort()).toEqual(
      [first.url, second.url, third.url].map((url) => url.slice(PUBLIC_BASE.length)).sort(),
    );
    expect(chitra.storage.files.size).toBe(0);

    const tooMany = await appError(
      chitra.data.createDevice(
        C,
        businessId,
        deviceInput({
          inventoryReference: "GP-0011",
          images: Array.from({ length: 9 }, (_, index) => ({
            url: `${PUBLIC_BASE}${businessId}/0000000${index}-1111-4111-8111-111111111111.png`,
            isPrimary: index === 0,
          })),
        }),
      ),
    );
    expect(tooMany.fieldErrors).toEqual({ images: "You can add up to 8 photos." });
  });

  it("updates storefront settings, including logo and banner", async () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]);
    const logo = await chitra.data.saveImage(C, businessId, { bytes: png, contentType: "image/png" });
    const banner = await chitra.data.saveImage(C, businessId, { bytes: png, contentType: "image/jpeg" });
    const hours = {
      mon: { closed: false, open: "10:30", close: "21:00" },
      tue: { closed: false, open: "10:30", close: "21:00" },
      wed: { closed: false, open: "10:30", close: "21:00" },
      thu: { closed: false, open: "10:30", close: "21:00" },
      fri: { closed: false, open: "10:30", close: "21:00" },
      sat: { closed: false, open: "10:30", close: "21:00" },
      sun: { closed: true, open: "10:30", close: "21:00" },
    };

    const updated = await chitra.data.updateStorefront(
      C,
      businessId,
      storefrontInput(
        { ...gammaInput, name: "Gamma Phones & Co", description: "Graded phones", instagramHandle: "gamma.phones", phoneNumber: "919812345678" },
        { logoUrl: logo.url, bannerUrl: banner.url, coverStyle: "ember", hours, showPricesByDefault: false },
      ),
    );
    expect(updated).toMatchObject({
      name: "Gamma Phones & Co",
      description: "Graded phones",
      instagramHandle: "gamma.phones",
      phoneNumber: "919812345678",
      logoUrl: logo.url,
      bannerUrl: banner.url,
      settings: { coverStyle: "ember", hours, showPricesByDefault: false, showSoldDevices: true, onboardingCompletedAt: null },
    });
    expect(await chitra.data.getPublicShop("gamma-phones")).toMatchObject({
      name: "Gamma Phones & Co",
      logoUrl: logo.url,
      bannerUrl: banner.url,
      coverStyle: "ember",
      hours,
    });

    // Replacing the logo and clearing the banner removes the old files.
    const nextLogo = await chitra.data.saveImage(C, businessId, { bytes: png, contentType: "image/webp" });
    const before = chitra.storage.removed.length;
    const replaced = await chitra.data.updateStorefront(
      C,
      businessId,
      storefrontInput(gammaInput, { logoUrl: nextLogo.url, bannerUrl: null, coverStyle: "ember" }),
    );
    expect(replaced).toMatchObject({ name: "Gamma Phones", logoUrl: nextLogo.url, bannerUrl: null });
    expect(chitra.storage.removed.slice(before).sort()).toEqual(
      [logo.url, banner.url].map((url) => url.slice(PUBLIC_BASE.length)).sort(),
    );

    for (const [field, url] of [
      ["logoUrl", "https://tracker.example/logo.png"],
      ["bannerUrl", `${PUBLIC_BASE}${alpha.business}/11111111-1111-4111-8111-111111111111.png`],
    ] as const) {
      const error = await appError(
        chitra.data.updateStorefront(C, businessId, storefrontInput(gammaInput, { logoUrl: nextLogo.url, [field]: url })),
      );
      expect(error.code).toBe("validation");
      expect(error.fieldErrors).toEqual({ [field]: "That image could not be used. Please upload it again." });
    }

    // Changing the address frees the old one and refuses a taken one.
    const moved = await chitra.data.updateStorefront(
      C,
      businessId,
      storefrontInput({ ...gammaInput, slug: "gamma-mobiles" }, { logoUrl: nextLogo.url }),
    );
    expect(moved.slug).toBe("gamma-mobiles");
    expect(await chitra.data.getPublicShop("gamma-phones")).toBeNull();
    const clash = await appError(
      chitra.data.updateStorefront(C, businessId, storefrontInput({ ...gammaInput, slug: "alpha-phones" }, { logoUrl: nextLogo.url })),
    );
    expect(clash.fieldErrors).toEqual({ slug: "That storefront address is already taken." });
    await chitra.data.updateStorefront(C, businessId, storefrontInput(gammaInput, { logoUrl: nextLogo.url }));
    expect((await chitra.data.getPublicShop("gamma-phones"))?.logoUrl).toBe(nextLogo.url);
  });

  it("completes onboarding once", async () => {
    const done = await chitra.data.completeOnboarding(C, businessId);
    expect(done.settings.onboardingCompletedAt).toMatch(ISO);
    const again = await chitra.data.completeOnboarding(C, businessId);
    expect(again.settings.onboardingCompletedAt).toBe(done.settings.onboardingCompletedAt);
    // Later settings changes keep it.
    const later = await chitra.data.updateStorefront(C, businessId, storefrontInput(gammaInput, { logoUrl: again.logoUrl }));
    expect(later.settings.onboardingCompletedAt).toBe(done.settings.onboardingCompletedAt);
  });

  it("records activity for what happened, newest first, under the real author", async () => {
    const activity = await chitra.data.listActivity(C, businessId, 200);
    const actions = activity.map((entry) => entry.action);
    for (const expected of [
      "business_created",
      "storefront_updated",
      "device_added",
      "device_updated",
      "device_sold",
      "device_reserved",
      "device_available",
      "price_hidden",
      "device_deleted",
    ]) {
      expect(actions, expected).toContain(expected);
    }
    expect(Object.keys(activity[0]).sort()).toEqual([
      "action",
      "businessId",
      "deviceId",
      "id",
      "performedBy",
      "performedByName",
      "reference",
      "subject",
      "timestamp",
    ]);
    expect(activity.every((entry) => entry.businessId === businessId && entry.performedBy === C)).toBe(true);
    expect(activity.every((entry) => entry.performedByName === "Chitra" || entry.performedByName === "Chitra Rao")).toBe(true);
    expect(activity.every((entry) => ISO.test(entry.timestamp))).toBe(true);
    const times = activity.map((entry) => entry.timestamp);
    expect(times).toEqual([...times].sort().reverse());

    // The edit that also reserved the phone and hid its price logged all three.
    const edit = activity.filter((entry) => entry.reference === "GP-0003" && entry.subject.includes("Pro Max"));
    expect(edit.map((entry) => entry.action)).toEqual(["device_deleted", "price_hidden", "device_reserved", "device_updated"]);
    expect(edit[0]).toMatchObject({ deviceId: null, subject: "iPhone 14 Pro Max · 512 GB · Gold" });
    // Entries for a deleted device survive, detached from it.
    expect(activity.filter((entry) => entry.reference === "GP-0003").every((entry) => entry.deviceId === null)).toBe(true);

    expect(await chitra.data.listActivity(C, businessId, 3)).toHaveLength(3);
  });

  it("counts real storefront views and inquiries only", async () => {
    const empty = await chitra.data.getAnalytics(C, businessId, 7);
    expect(empty).toMatchObject({ totalViews: 0, totalInquiries: 0, inquiriesByDevice: {} });
    expect(empty.days).toHaveLength(7);
    expect(empty.days.at(-1)).toEqual({ day: istDay(Date.now()), views: 0, inquiries: 0 });

    const shortId = (await chitra.data.getDevice(C, businessId, deviceIds[0]))!.shortId;
    await chitra.data.recordEvent("gamma-phones", "view");
    await chitra.data.recordEvent("gamma-phones", "view");
    await chitra.data.recordEvent("gamma-phones", "inquiry", shortId);
    await chitra.data.recordEvent("gamma-phones", "inquiry", null);
    await chitra.data.recordEvent("no-such-shop", "view");

    const analytics = await chitra.data.getAnalytics(C, businessId, 7);
    expect(analytics.totalViews).toBe(2);
    expect(analytics.totalInquiries).toBe(2);
    expect(analytics.inquiriesByDevice).toEqual({ [shortId]: 1 });
    expect(analytics.days.at(-1)).toEqual({ day: istDay(Date.now()), views: 2, inquiries: 2 });
    expect(analytics.days.map((day) => day.day)).toEqual([...analytics.days.map((day) => day.day)].sort());
  });

  describe("tenant isolation through the driver", () => {
    let deltaBusiness: string;
    let gammaDevice: string;

    beforeAll(async () => {
      deltaBusiness = (await dev.data.createBusiness(D, businessInput("Delta Mobiles", "delta-mobiles"))).id;
      await dev.data.createDevice(D, deltaBusiness, deviceInput({ inventoryReference: "DM-0001" }));
      gammaDevice = deviceIds[0];
    });

    it("refuses every private operation on another retailer's business", async () => {
      const attempts: (() => Promise<unknown>)[] = [
        () => dev.data.listDevices(D, businessId),
        () => dev.data.getDevice(D, businessId, gammaDevice),
        () => dev.data.createDevice(D, businessId, deviceInput({ inventoryReference: "X-1" })),
        () => dev.data.updateDevice(D, businessId, gammaDevice, deviceInput({ inventoryReference: "X-2" })),
        () => dev.data.setAvailability(D, businessId, gammaDevice, "sold"),
        () => dev.data.setPriceVisibility(D, businessId, gammaDevice, false),
        () => dev.data.deleteDevice(D, businessId, gammaDevice),
        () => dev.data.suggestReference(D, businessId),
        () => dev.data.listActivity(D, businessId, 10),
        () => dev.data.getAnalytics(D, businessId, 7),
        () => dev.data.completeOnboarding(D, businessId),
        () => dev.data.updateStorefront(D, businessId, storefrontInput(businessInput("Hijacked", "hijacked"))),
      ];
      for (const attempt of attempts) {
        const error = await appError(attempt());
        expect(error.code).toBe("forbidden");
        expect(error.message).toBe("You don't have access to this business.");
      }
    });

    it("cannot reach another retailer's device through its own business", async () => {
      expect(await dev.data.getDevice(D, deltaBusiness, gammaDevice)).toBeNull();
      const attempts: (() => Promise<unknown>)[] = [
        () => dev.data.setAvailability(D, deltaBusiness, gammaDevice, "sold"),
        () => dev.data.setPriceVisibility(D, deltaBusiness, gammaDevice, false),
        () => dev.data.deleteDevice(D, deltaBusiness, gammaDevice),
        () => dev.data.updateDevice(D, deltaBusiness, gammaDevice, deviceInput({ inventoryReference: "DM-0009" })),
      ];
      for (const attempt of attempts) {
        const error = await appError(attempt());
        expect(error.code).toBe("not_found");
        expect(error.message).toBe("That device is no longer in your inventory.");
      }
    });

    it("cannot attach another retailer's uploads to its own devices", async () => {
      const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]);
      const foreign = await chitra.data.saveImage(C, businessId, { bytes: png, contentType: "image/png" });
      const error = await appError(
        dev.data.createDevice(D, deltaBusiness, deviceInput({ inventoryReference: "DM-0002", images: [{ url: foreign.url, isPrimary: true }] })),
      );
      expect(error.fieldErrors).toEqual({ images: "One of the photos could not be attached. Please upload it again." });
    });

    it("gets its own business, never the other one", async () => {
      expect((await dev.data.getBusinessForUser(D))?.id).toBe(deltaBusiness);
      // The id passed in is irrelevant: the database answers for the session.
      expect((await dev.data.getBusinessForUser(C))?.id).toBe(deltaBusiness);
      expect((await dev.data.listDevices(D, deltaBusiness)).map((device) => device.inventoryReference)).toEqual(["DM-0001"]);
    });

    it("leaves the other retailer's data untouched after the attempts", async () => {
      const device = await chitra.data.getDevice(C, businessId, gammaDevice);
      expect(device).toMatchObject({ availabilityStatus: "available", showPrice: true, notes: PRIVATE_NOTE });
      expect((await chitra.data.getPublicShop("gamma-phones"))?.name).toBe("Gamma Phones");
      expect(await chitra.data.getPublicShop("hijacked")).toBeNull();
      expect(await dev.data.listDevices(D, deltaBusiness)).toHaveLength(1);
    });

    it("gives a signed-out caller nothing private", async () => {
      const visitor = driverFor(ANON);
      for (const attempt of [
        () => visitor.data.getBusinessForUser(C),
        () => visitor.data.listDevices(C, businessId),
        () => visitor.data.getDevice(C, businessId, gammaDevice),
        () => visitor.data.deleteDevice(C, businessId, gammaDevice),
        () => visitor.data.listActivity(C, businessId, 10),
        () => visitor.data.isSlugAvailable("anything-free"),
      ]) {
        expect((await appError(attempt())).code).toBe("forbidden");
      }
      // Public data still works without a session.
      expect((await visitor.data.listPublicDevices("gamma-phones")).length).toBeGreaterThan(0);
    });
  });
});

/* -------------------------------------------------------------------------- */

describe("SQL helpers stay in step with the app", () => {
  it("device_label matches deviceLabel()", async () => {
    const samples = [
      ...SEED_BUSINESSES.flatMap((business) => business.devices).map((device) => ({
        brand: device.brand,
        model: device.model,
        storageGb: device.storageGb,
        colour: device.colour,
      })),
      { brand: "Apple", model: "iPhone 15 Pro Max", storageGb: 1024, colour: "Natural Titanium" },
      { brand: "Samsung", model: "Galaxy S24 Ultra", storageGb: 2048, colour: " Titanium Grey " },
      { brand: "OnePlus", model: "OnePlus 12", storageGb: 512, colour: "Flowy Emerald" },
      { brand: "oneplus", model: "OnePlus Nord 3", storageGb: 1536, colour: "" },
      { brand: "", model: "Mystery Phone", storageGb: 64, colour: "Black" },
      { brand: "Nothing", model: "Phone (2)", storageGb: 256, colour: "Dark Grey" },
    ];
    for (const sample of samples) {
      const sql = await scalar<string>("select private.device_label($1, $2, $3, $4) as value", [
        sample.brand,
        sample.model,
        sample.storageGb,
        sample.colour,
      ]);
      expect(sql, JSON.stringify(sample)).toBe(deviceLabel(sample));
    }
  });

  it("reserves exactly the storefront addresses the app reserves", async () => {
    const source = await scalar<string>(
      "select prosrc as value from pg_proc where proname = 'is_reserved_slug' and pronamespace = 'private'::regnamespace",
    );
    const inSql = [...source.matchAll(/'([a-z0-9-]+)'/g)].map((match) => match[1]).sort();
    expect(inSql).toEqual([...RESERVED_SLUGS].sort());
    for (const slug of RESERVED_SLUGS) {
      expect(await scalar<boolean>("select private.is_reserved_slug($1) as value", [slug]), slug).toBe(true);
    }
    expect(await scalar<boolean>("select private.is_reserved_slug('urban-mobile-studio') as value")).toBe(false);
  });

  it("accepts exactly the cover styles the app offers", async () => {
    for (const id of COVER_STYLE_IDS) {
      expect(
        await scalar<boolean>("select private.valid_business_settings(jsonb_build_object('coverStyle', $1::text)) as value", [id]),
        id,
      ).toBe(true);
    }
    const source = await scalar<string>(
      "select prosrc as value from pg_proc where proname = 'valid_business_settings' and pronamespace = 'private'::regnamespace",
    );
    const list = /'coverStyle' in \(([^)]+)\)/.exec(source)?.[1] ?? "";
    expect([...list.matchAll(/'([a-z]+)'/g)].map((match) => match[1]).sort()).toEqual([...COVER_STYLE_IDS].sort());
    expect(await scalar<boolean>(`select private.valid_business_settings('{"coverStyle": "neon"}') as value`)).toBe(false);
    expect(await scalar<boolean>(`select private.valid_business_settings('{"coverStyle": null}') as value`)).toBe(false);
    expect(await scalar<boolean>(`select private.valid_business_settings('{"showSoldDevices": "yes"}') as value`)).toBe(false);
  });

  it("uses the same IST day and timestamp format as the app", async () => {
    const instants = [
      "2026-11-16T18:29:59.999Z",
      "2026-11-16T18:30:00.000Z",
      "2026-12-31T20:15:42.123Z",
      "2027-01-01T00:00:00.000Z",
      "2024-02-29T18:31:00.000Z",
    ];
    for (const instant of instants) {
      expect(await scalar<string>("select to_char(private.ist_day($1::timestamptz), 'YYYY-MM-DD') as value", [instant]), instant).toBe(
        istDay(instant),
      );
      expect(await scalar<string>("select private.iso($1::timestamptz) as value", [instant]), instant).toBe(instant);
    }
    expect(await scalar<string>("select private.iso(private.created_at_for('2020-01-15'::date)) as value")).toBe(
      istDayToIso("2020-01-15"),
    );
    expect(await scalar<string | null>("select private.iso(null) as value")).toBeNull();
  });

  it("accepts only image paths inside the business's own folder", async () => {
    const owns = (value: string) => scalar<boolean>("select private.owns_image_path($1::uuid, $2) as value", [alpha.business, value]);
    const file = "11111111-1111-4111-8111-111111111111";
    expect(await owns(`${alpha.business}/${file}.png`)).toBe(true);
    expect(await owns(`${alpha.business}/${file}.webp`)).toBe(true);
    for (const bad of [
      `${beta.business}/${file}.png`,
      `${alpha.business}/${file}.svg`,
      `${alpha.business}/${file}.png?x=1`,
      `${alpha.business}/../${beta.business}/${file}.png`,
      `https://evil.example/${alpha.business}/${file}.png`,
      `/${alpha.business}/${file}.png`,
      `${alpha.business}/nested/${file}.png`,
      "",
    ]) {
      expect(await owns(bad), bad).toBe(false);
    }
  });
});

/* -------------------------------------------------------------------------- */

describe("seed.sql (demo retailers)", () => {
  const normalise = (value: string) => value.replace(/\r\n/g, "\n");

  beforeAll(async () => {
    await db.exec(SEED_FILE);
  });

  it("is up to date with the app's seed data", () => {
    expect(normalise(SEED_FILE)).toBe(normalise(buildSeedSql(SEED_BUSINESSES)));
  });

  it("creates the three fictional storefronts, readable without signing in", async () => {
    const visitor = driverFor(ANON).data;
    for (const seed of SEED_BUSINESSES) {
      const shop = await visitor.getPublicShop(seed.slug);
      expect(shop, seed.slug).toMatchObject({
        name: seed.name,
        slug: seed.slug,
        isDemo: true,
        description: seed.description,
        location: seed.location,
        whatsappNumber: seed.whatsappNumber,
        phoneNumber: seed.phoneNumber,
        instagramHandle: seed.instagramHandle,
        coverStyle: seed.coverStyle,
        hours: seed.hours,
        logoUrl: null,
        bannerUrl: null,
      });

      const expected = seed.devices.filter((device) => seed.showSoldDevices || device.status !== "sold");
      const listed = await visitor.listPublicDevices(seed.slug);
      expect(listed.map((device) => device.reference).sort(), seed.slug).toEqual(expected.map((device) => device.ref).sort());

      for (const device of listed) {
        const source = seed.devices.find((candidate) => candidate.ref === device.reference)!;
        const priceIsPublic = source.showPrice && source.price !== null && source.status !== "sold";
        expect(device, device.reference).toMatchObject({
          brand: source.brand,
          model: source.model,
          storageGb: source.storageGb,
          colour: source.colour,
          batteryHealth: source.battery,
          condition: source.condition,
          cosmeticCondition: source.cosmetic,
          functionalCondition: source.functional,
          accessories: source.accessories,
          warranty: source.warranty,
          availability: source.status,
          price: priceIsPublic ? source.price : null,
          images: [],
        });
      }

      // Newest first within each availability group, like the demo driver.
      const available = listed.filter((device) => device.availability === "available").map((device) => device.reference);
      expect(available).toEqual(
        seed.devices
          .filter((device) => device.status === "available")
          .sort((a, b) => a.addedHoursAgo - b.addedHoursAgo)
          .map((device) => device.ref),
      );
    }
  });

  it("keeps hidden prices and internal notes out of seeded public data", async () => {
    const visitor = driverFor(ANON).data;
    const payload = JSON.stringify(
      await Promise.all(SEED_BUSINESSES.map((seed) => visitor.listPublicDevices(seed.slug))),
    );
    for (const seed of SEED_BUSINESSES) {
      for (const device of seed.devices) {
        if (device.notes) expect(payload, `${device.ref} notes`).not.toContain(device.notes);
      }
    }
    expect(payload).not.toContain("Do not go below");
    const prime = await visitor.listPublicDevices("prime-device-hub");
    expect(prime.find((device) => device.reference === "PDH-0008")?.price).toBeNull();
    expect(prime.find((device) => device.reference === "PDH-0005")?.price).toBe(25500);
    expect(prime.some((device) => device.reference === "PDH-0001")).toBe(false);
  });

  it("never mixes inventory between storefronts", async () => {
    const visitor = driverFor(ANON).data;
    const urban = (await visitor.listPublicDevices("urban-mobile-studio")).map((device) => device.reference);
    const prime = (await visitor.listPublicDevices("prime-device-hub")).map((device) => device.reference);
    expect(urban.every((reference) => reference.startsWith("UMS-"))).toBe(true);
    expect(prime.every((reference) => reference.startsWith("PDH-"))).toBe(true);
  });

  it("makes the demo retailers ownerless and read-only for everyone", async () => {
    const demo = await admin<{ id: string; owner_id: string | null; members: number }>(`
      select b.id, b.owner_id, (select count(*)::int from public.business_members m where m.business_id = b.id) as members
      from public.businesses b where b.is_demo order by b.slug
    `);
    expect(demo.rows).toHaveLength(SEED_BUSINESSES.length);
    expect(demo.rows.every((row) => row.owner_id === null && row.members === 0)).toBe(true);

    const urban = await scalar<string>("select id as value from public.businesses where slug = 'urban-mobile-studio'");
    const total = await scalar<number>("select count(*)::int as value from public.devices where business_id = $1", [urban]);

    for (const identity of [user(A), user(E)]) {
      expect((await run(identity, "select 1 from public.devices where business_id = $1", [urban])).rows).toEqual([]);
      expect((await run(identity, "update public.devices set price = 1 where business_id = $1", [urban])).affectedRows).toBe(0);
      expect((await run(identity, "delete from public.devices where business_id = $1", [urban])).affectedRows).toBe(0);
      expect((await run(identity, "update public.businesses set name = 'Mine now' where id = $1", [urban])).affectedRows).toBe(0);
      await expect(run(identity, "select public.list_devices($1)", [urban])).rejects.toThrow(/onhand:forbidden/);
    }
    // Nobody can claim an existing demo shop by creating a business over it.
    await expect(
      run(user(E), "update public.businesses set owner_id = $1 where id = $2", [E, urban]),
    ).rejects.toThrow(DENIED);

    expect(await scalar<number>("select count(*)::int as value from public.devices where business_id = $1", [urban])).toBe(total);
    expect(await scalar<string>("select name as value from public.businesses where id = $1", [urban])).toBe("Urban Mobile Studio");
  });

  it("writes a matching activity history and does not duplicate when run again", async () => {
    const counts = () =>
      admin<{ slug: string; devices: number; activity: number }>(`
        select b.slug,
               (select count(*)::int from public.devices d where d.business_id = b.id) as devices,
               (select count(*)::int from public.inventory_activity a where a.business_id = b.id) as activity
        from public.businesses b where b.is_demo order by b.slug
      `);
    const before = (await counts()).rows;
    expect(before).toEqual(
      [...SEED_BUSINESSES]
        .sort((a, b) => a.slug.localeCompare(b.slug))
        .map((seed) => ({
          slug: seed.slug,
          devices: seed.devices.length,
          activity: 1 + seed.devices.length + seed.devices.filter((device) => device.soldHoursAgo !== undefined).length,
        })),
    );

    await db.exec(SEED_FILE);
    expect((await counts()).rows).toEqual(before);

    const sold = await admin<{ sold_at_set: boolean; status: string }>(
      "select sold_at is not null as sold_at_set, availability_status as status from public.devices where inventory_reference = 'UMS-0002'",
    );
    expect(sold.rows).toEqual([{ sold_at_set: true, status: "sold" }]);
    expect(await scalar<string>("select subject as value from public.inventory_activity where reference = 'UMS-0016' and action = 'device_added'")).toBe(
      "iPhone 15 Pro · 256 GB · Natural Titanium",
    );
  });
});
