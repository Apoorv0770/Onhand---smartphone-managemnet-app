#!/usr/bin/env node
/**
 * Generates supabase/seed.sql from the demo data in
 * src/server/backend/seed-data.ts, so demo mode and Supabase show the same
 * three fictional retailers.
 *
 *   node scripts/generate-supabase-seed.mjs
 *
 * No dependencies: the TypeScript source is imported directly using Node's
 * built-in type stripping (Node 22.18+ or 23.6+). Re-run it after editing the
 * seed data. tests/supabase-rls.test.ts fails if seed.sql is out of date.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = "src/server/backend/seed-data.ts";
const TARGET = "supabase/seed.sql";

/** SQL string literal. */
function text(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function nullable(value) {
  return value === null || value === undefined ? "null" : text(value);
}

function number(value) {
  return value === null || value === undefined ? "null" : String(Math.trunc(value));
}

function textArray(values) {
  return values.length ? `array[${values.map(text).join(", ")}]::text[]` : "'{}'::text[]";
}

function ago(amount, unit) {
  return `now() - interval '${Math.trunc(amount)} ${unit}'`;
}

function deviceBlock(device, ownerName) {
  const added = ago(device.addedHoursAgo, "hours");
  const sold = device.soldHoursAgo === undefined ? null : ago(device.soldHoursAgo, "hours");
  const label = `private.device_label(${text(device.brand)}, ${text(device.model)}, ${number(device.storageGb)}, ${text(device.colour)})`;

  const lines = [
    `    -- ${device.ref} · ${device.brand} ${device.model}`,
    "    insert into public.devices (",
    "      business_id, inventory_reference, brand, model, storage_gb, colour, battery_health, condition,",
    "      cosmetic_condition, functional_condition, accessories, warranty, notes, price, show_price,",
    "      availability_status, created_at, updated_at, sold_at",
    "    ) values (",
    `      v_business, ${text(device.ref)}, ${text(device.brand)}, ${text(device.model)}, ${number(device.storageGb)}, ${text(device.colour)}, ${number(device.battery)}, ${text(device.condition)},`,
    `      ${text(device.cosmetic)},`,
    `      ${text(device.functional)},`,
    `      ${textArray(device.accessories)}, ${text(device.warranty)},`,
    `      ${text(device.notes)},`,
    `      ${number(device.price)}, ${device.showPrice ? "true" : "false"}, ${text(device.status)}, ${added}, ${sold ?? added}, ${sold ?? "null"}`,
    "    ) returning id into v_device;",
    "    insert into public.inventory_activity (business_id, device_id, action, subject, reference, performed_by, performed_by_name, created_at)",
    `    values (v_business, v_device, 'device_added', ${label}, ${text(device.ref)}, null, ${text(ownerName)}, ${added});`,
  ];

  if (sold) {
    lines.push(
      "    insert into public.inventory_activity (business_id, device_id, action, subject, reference, performed_by, performed_by_name, created_at)",
      `    values (v_business, v_device, 'device_sold', ${label}, ${text(device.ref)}, null, ${text(ownerName)}, ${sold});`,
    );
  }
  return lines.join("\n");
}

function businessBlock(business) {
  const created = ago(business.createdDaysAgo, "days");
  const settings = [
    "jsonb_build_object(",
    `        'showPricesByDefault', ${business.showPricesByDefault ? "true" : "false"},`,
    `        'showSoldDevices', ${business.showSoldDevices ? "true" : "false"},`,
    `        'coverStyle', ${text(business.coverStyle)},`,
    `        'hours', ${text(JSON.stringify(business.hours))}::jsonb,`,
    `        'onboardingCompletedAt', private.iso(${created})`,
    "      )",
  ].join("\n");

  return [
    "-- -----------------------------------------------------------------------------",
    `-- ${business.name} (/shop/${business.slug})`,
    "-- -----------------------------------------------------------------------------",
    "do $seed$",
    "declare",
    "  v_business uuid;",
    "  v_device uuid;",
    "begin",
    `  if exists (select 1 from public.businesses where slug = ${text(business.slug)}) then`,
    `    raise notice 'Demo retailer "%" already exists. Skipping.', ${text(business.slug)};`,
    "  else",
    "    insert into public.businesses (",
    "      owner_id, is_demo, name, slug, description, location, whatsapp_number, phone_number,",
    "      instagram_handle, settings, created_at",
    "    ) values (",
    `      null, true, ${text(business.name)}, ${text(business.slug)},`,
    `      ${text(business.description)},`,
    `      ${text(business.location)}, ${text(business.whatsappNumber)}, ${nullable(business.phoneNumber)},`,
    `      ${nullable(business.instagramHandle)},`,
    `      ${settings},`,
    `      ${created}`,
    "    ) returning id into v_business;",
    "",
    "    insert into public.inventory_activity (business_id, device_id, action, subject, reference, performed_by, performed_by_name, created_at)",
    `    values (v_business, null, 'business_created', ${text(business.name)}, null, null, ${text(business.owner.name)}, ${created});`,
    "",
    business.devices.map((device) => deviceBlock(device, business.owner.name)).join("\n\n"),
    "  end if;",
    "end",
    "$seed$;",
  ].join("\n");
}

/** Builds the full contents of supabase/seed.sql. */
export function buildSeedSql(businesses) {
  const deviceCount = businesses.reduce((sum, business) => sum + business.devices.length, 0);
  const header = [
    "-- =============================================================================",
    "-- Onhand · demo data for Supabase",
    "--",
    `-- GENERATED by scripts/generate-supabase-seed.mjs from ${SOURCE}.`,
    "-- Do not edit by hand: change the seed data and run the script again.",
    "--",
    `-- ${businesses.length} fictional retailers in Amravati, Maharashtra, with ${deviceCount} devices. The shops,`,
    "-- their addresses, staff names and stock are invented. Phone numbers use a",
    "-- 555 prefix, which is not a valid Indian mobile range.",
    "--",
    "-- The demo retailers have no owner (owner_id is null, is_demo is true) and no",
    "-- members, so nobody can sign in to them or change them: they are read-only",
    "-- storefronts. Sign up in the app to create a real, editable business.",
    "--",
    "-- Run after the migrations. Safe to run more than once: a retailer that",
    "-- already exists is skipped. To remove the demo data:",
    "--   delete from public.businesses where is_demo;",
    "-- =============================================================================",
  ].join("\n");

  return `${header}\n\n${businesses.map(businessBlock).join("\n\n")}\n`;
}

const invokedDirectly =
  Boolean(process.argv[1]) && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (invokedDirectly) {
  const { SEED_BUSINESSES } = await import(pathToFileURL(path.join(root, SOURCE)).href);
  const sql = buildSeedSql(SEED_BUSINESSES);
  fs.mkdirSync(path.dirname(path.join(root, TARGET)), { recursive: true });
  fs.writeFileSync(path.join(root, TARGET), sql, "utf8");
  const devices = SEED_BUSINESSES.reduce((sum, business) => sum + business.devices.length, 0);
  console.log(`Wrote ${TARGET}: ${SEED_BUSINESSES.length} demo retailers, ${devices} devices.`);
}
