#!/usr/bin/env node
/**
 * Checks the Supabase setup for this app and says what is still missing.
 *
 *   npm run supabase:check
 *
 * It reads .env.local (or the env file given as the first argument), then makes
 * a handful of read-only requests to your Supabase project. It never prints a
 * key, and it never writes to the project.
 */
import fs from "node:fs";
import path from "node:path";

const ENV_FILE = path.resolve(process.cwd(), process.argv[2] ?? ".env.local");
const ENV_NAME = path.basename(ENV_FILE);
const EXAMPLE_FILE = path.join(process.cwd(), ".env.example");
const BUCKET = "device-images";
const DEMO_SLUG = "urban-mobile-studio";
const TABLES = [
  "businesses",
  "devices",
  "device_images",
  "business_members",
  "inventory_activity",
  "storefront_events",
  "profiles",
];
const KEY_NAMES = ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];

const results = [];
const next = [];
/** Values that must never reach the terminal, whatever a server echoes back. */
const hidden = [];
let failed = false;
let connected = false;

function report(state, text) {
  results.push({ state, text });
  if (state === "fail") failed = true;
}

/** True when a bare line looks like a Supabase key pasted without its variable name. */
function looksLikeKey(text) {
  return /^(sb_(publishable|secret)_|eyJ)[A-Za-z0-9._-]{8,}$/.test(text);
}

/**
 * Reads a .env file the way Next.js does for simple NAME=value lines.
 * Returns null when the file does not exist. `strayKeyLine` is the line number
 * of a key that was pasted on a line of its own, which Next.js would ignore.
 */
function parseEnvFile(file) {
  if (!fs.existsSync(file)) return null;
  const values = {};
  let strayKeyLine = 0;
  fs.readFileSync(file, "utf8")
    .split(/\r?\n/)
    .forEach((raw, lineIndex) => {
      const line = raw.trim();
      if (!line || line.startsWith("#")) return;
      const index = line.indexOf("=");
      if (index === -1) {
        if (looksLikeKey(line)) strayKeyLine = lineIndex + 1;
        return;
      }
      const name = line.slice(0, index).trim();
      let value = line.slice(index + 1).trim();
      const quoted = /^(".*"|'.*')$/.test(value);
      value = quoted ? value.slice(1, -1) : value.replace(/\s+#.*$/, "");
      values[name] = value.trim();
    });
  return { values, strayKeyLine };
}

function projectRef(origin) {
  try {
    const match = /^([a-z0-9]{10,40})\.supabase\.(co|in|net)$/.exec(new URL(origin).hostname);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/** Describes a key from its shape alone. Nothing is sent anywhere. */
function describeKey(key) {
  if (key.startsWith("sb_publishable_")) return { kind: "publishable", label: 'publishable key ("sb_publishable_" format)' };
  if (key.startsWith("sb_secret_")) return { kind: "secret", label: 'SECRET key ("sb_secret_" format)' };
  const parts = key.split(".");
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
      if (payload.role === "service_role") return { kind: "secret", label: "legacy SERVICE_ROLE key", ref: payload.ref };
      if (payload.role === "anon") return { kind: "anon", label: "legacy anon key", ref: payload.ref };
    } catch {
      // Not a readable token. Fall through.
    }
  }
  return { kind: "unknown", label: "key in an unrecognised format" };
}

async function request(url, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
    return { status: response.status, body, headers: response.headers };
  } catch (error) {
    return { status: 0, error: error instanceof Error ? error.name : "Error" };
  } finally {
    clearTimeout(timer);
  }
}

/** A short description of an API error body. */
function reason(body) {
  if (!body || typeof body !== "object") return "";
  const text = body.message ?? body.msg ?? body.error_description ?? body.error ?? "";
  return typeof text === "string" ? text.slice(0, 140) : "";
}

const refused = (status) => status === 401 || status === 403 || status === 404;

async function main() {
  const parsed = parseEnvFile(ENV_FILE);
  if (!parsed) {
    report("fail", `${ENV_NAME} was not found in the project root`);
    next.push("Copy .env.example to .env.local and fill in your project URL and publishable key.");
    return;
  }
  const file = parsed.values;
  report("ok", `${ENV_NAME} found`);

  // Values in the real environment win, exactly as they do in Next.js.
  const read = (name) => (process.env[name] ?? file[name] ?? "").trim();

  for (const name of KEY_NAMES) {
    const value = read(name);
    if (value.length >= 8) hidden.push(value);
  }

  // .env.example is committed to git, so a real key must never live there.
  const example = parseEnvFile(EXAMPLE_FILE);
  if (example && (KEY_NAMES.some((name) => example.values[name]) || example.strayKeyLine)) {
    report("fail", ".env.example contains a key. That file is committed to git: move the key to .env.local and empty the line.");
  }

  const rawUrl = read("NEXT_PUBLIC_SUPABASE_URL");
  const key = read(KEY_NAMES[0]) || read(KEY_NAMES[1]);
  const expectedRef = read("ONHAND_SUPABASE_PROJECT_REF");

  if (!rawUrl) {
    report("todo", "NEXT_PUBLIC_SUPABASE_URL is empty, so the app runs in demo mode");
    next.push(`Set NEXT_PUBLIC_SUPABASE_URL in ${ENV_NAME} to your project URL.`);
    return;
  }

  // Never echo the raw value: a key pasted on the wrong line would end up here.
  let url = "";
  try {
    const candidate = new URL(rawUrl);
    if (candidate.protocol === "https:" || candidate.protocol === "http:") url = candidate.origin;
  } catch {
    url = "";
  }
  if (!url) {
    const hint = looksLikeKey(rawUrl) ? " (it looks like a key was pasted there)" : "";
    report("fail", `NEXT_PUBLIC_SUPABASE_URL is not a web address${hint}`);
    next.push("Set NEXT_PUBLIC_SUPABASE_URL to your project URL: https://<project-ref>.supabase.co");
    return;
  }

  const ref = projectRef(url);
  report(ref ? "ok" : "info", `Project URL: ${url}`);

  if (expectedRef) {
    if (ref === expectedRef) {
      report("ok", `Project ref matches the safety lock (${expectedRef})`);
    } else {
      report("fail", `Project URL does not match ONHAND_SUPABASE_PROJECT_REF (${expectedRef}). The app will refuse to connect.`);
      next.push("Make NEXT_PUBLIC_SUPABASE_URL and ONHAND_SUPABASE_PROJECT_REF refer to the same project.");
      return;
    }
  } else {
    report("info", "No ONHAND_SUPABASE_PROJECT_REF safety lock is set");
  }

  // Reachability needs no key: the API gateway answers even an anonymous request.
  const health = await request(`${url}/auth/v1/health`);
  if (health.status === 0) {
    report("fail", `The project did not answer (${health.error}). Check the URL and your connection.`);
    return;
  }
  const gatewayRef = health.headers?.get("sb-project-ref");
  if (gatewayRef && ref && gatewayRef !== ref) {
    report("fail", `The server answered for a different project (${gatewayRef})`);
    return;
  }
  if (health.status >= 500) {
    report("fail", `The project answered with HTTP ${health.status}. It may be paused or still starting: open it in the Supabase dashboard.`);
    return;
  }
  const expected = health.status === 401 ? ", as expected" : "";
  report("ok", `Project is reachable${gatewayRef ? ` and identifies itself as ${gatewayRef}` : ""} (HTTP ${health.status} without a key${expected})`);

  if (!key) {
    if (parsed.strayKeyLine) {
      report("fail", `Line ${parsed.strayKeyLine} of ${ENV_NAME} looks like a key on a line of its own, so it is being ignored`);
      next.push("Move it up so it sits directly after NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= on the same line, then run this check again.");
      return;
    }
    report("todo", "The publishable key is not set yet, so the app is still in demo mode");
    next.push(`Open ${ENV_NAME} and paste your publishable key after NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= (no quotes), then run this check again.`);
    return;
  }

  const described = describeKey(key);
  if (described.kind === "secret") {
    report("fail", `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY holds a ${described.label}. Never put that in this file.`);
    next.push("Replace it with the publishable key, then rotate the secret key in the Supabase dashboard because it has been stored in a NEXT_PUBLIC variable.");
    return;
  }
  if (described.ref && ref && described.ref !== ref) {
    report("fail", `The key belongs to a different project (${described.ref})`);
    next.push("Copy the publishable key from the same project as the URL.");
    return;
  }
  report(described.kind === "unknown" ? "info" : "ok", `Key present: ${described.label}`);

  const headers = { apikey: key, Authorization: `Bearer ${key}` };

  const settings = await request(`${url}/auth/v1/settings`, { headers });
  if (settings.status === 0) {
    report("fail", `The auth service did not answer (${settings.error})`);
    return;
  }
  if (settings.status === 401 || settings.status === 403) {
    report("fail", `The project rejected the key (HTTP ${settings.status}${reason(settings.body) ? `: ${reason(settings.body)}` : ""})`);
    next.push("Copy the publishable key again from Project Settings, API Keys, in the same project as the URL.");
    return;
  }
  if (settings.status !== 200 || !settings.body) {
    report("fail", `Unexpected answer from the auth service (HTTP ${settings.status})`);
    return;
  }
  connected = true;
  report("ok", "Key accepted by the project: this URL and key can connect");

  const emailEnabled = settings.body.external?.email !== false;
  const signupsOpen = settings.body.disable_signup !== true;
  if (!emailEnabled || !signupsOpen) {
    report("todo", "Email sign-ups are switched off in this project");
    next.push("Authentication, Sign In / Providers: enable the Email provider and allow new users to sign up.");
  } else if (settings.body.mailer_autoconfirm === true) {
    report("ok", 'Email sign-up is on and "Confirm email" is off: new accounts can sign in immediately');
  } else {
    report("todo", '"Confirm email" is on: test accounts with made-up addresses cannot finish signing up');
    next.push('For testing, turn "Confirm email" off under Authentication, Sign In / Providers, Email. Turn it back on (with your own SMTP) before launch.');
  }

  const rest = { ...headers, "Content-Type": "application/json" };
  const shop = await request(`${url}/rest/v1/rpc/get_public_shop`, {
    method: "POST",
    headers: rest,
    body: JSON.stringify({ p_slug: DEMO_SLUG }),
  });
  const schemaInstalled = shop.status === 200;
  if (schemaInstalled) {
    report("ok", "Database schema is installed (the storefront functions answer)");
  } else if (shop.status === 404) {
    report("todo", "Database schema is not installed yet");
    next.push("In the SQL editor run supabase/migrations/0001_init.sql, then supabase/migrations/0002_storage.sql (and optionally supabase/seed.sql).");
  } else {
    report("fail", `Unexpected answer from the database API (HTTP ${shop.status}${reason(shop.body) ? `: ${reason(shop.body)}` : ""})`);
  }

  if (schemaInstalled) {
    // A visitor holds only the publishable key. The migration gives that role
    // no table access at all, so every one of these must be refused.
    const exposed = [];
    const permitted = [];
    for (const table of TABLES) {
      const answer = await request(`${url}/rest/v1/${table}?select=*&limit=1`, { headers: rest });
      if (answer.status === 200 && Array.isArray(answer.body) && answer.body.length > 0) exposed.push(table);
      else if (!refused(answer.status)) permitted.push(`${table} (HTTP ${answer.status})`);
    }
    if (exposed.length > 0) {
      report("fail", `Anonymous visitors can read rows from: ${exposed.join(", ")}. Re-run supabase/migrations/0001_init.sql.`);
    } else if (permitted.length > 0) {
      report("fail", `These tables did not refuse an anonymous request, although no rows came back: ${permitted.join(", ")}. Re-run supabase/migrations/0001_init.sql to reset table privileges.`);
    } else {
      report("ok", "Anonymous visitors are refused on every table (storefronts read only through the public functions)");
    }

    const privateCall = await request(`${url}/rest/v1/rpc/get_my_context`, { method: "POST", headers: rest, body: "{}" });
    if (refused(privateCall.status)) {
      report("ok", "Retailer-only functions refuse anonymous callers");
    } else {
      report("fail", `A retailer-only function answered an anonymous caller (HTTP ${privateCall.status}). Re-run supabase/migrations/0001_init.sql.`);
    }
  }

  const object = await request(`${url}/storage/v1/object/public/${BUCKET}/onhand-setup-check.png`, { headers });
  const objectReason = `${reason(object.body)} ${typeof object.body?.error === "string" ? object.body.error : ""}`.toLowerCase();
  if (objectReason.includes("bucket not found")) {
    report("todo", `Storage bucket "${BUCKET}" does not exist yet`);
    if (schemaInstalled) next.push("In the SQL editor run supabase/migrations/0002_storage.sql.");
  } else if (object.status === 400 || object.status === 404) {
    report("ok", `Storage bucket "${BUCKET}" exists and is public`);
  } else {
    report("info", `Could not confirm the storage bucket (HTTP ${object.status})`);
  }

  if (schemaInstalled) {
    report("info", shop.body ? "Demo storefronts are seeded" : "Demo storefronts are not seeded (optional: supabase/seed.sql)");
  }
}

await main();

const scrub = (text) => hidden.reduce((out, value) => out.split(value).join("[key hidden]"), text);
const print = (text = "") => console.log(scrub(text));
const mark = { ok: "[ ok ]", todo: "[todo]", fail: "[FAIL]", info: "[info]" };

print("\nOnhand · Supabase setup check\n");
for (const { state, text } of results) print(`  ${mark[state]}  ${text}`);

const todos = results.filter((entry) => entry.state === "todo").length;
const steps = `${todos} setup ${todos === 1 ? "step" : "steps"} remaining`;
if (failed) print("\nResult: there is a problem to fix.");
else if (!connected) print(`\nResult: not connected yet, ${steps}.`);
else if (todos > 0) print(`\nResult: the key works, ${steps}.`);
else print("\nResult: everything this app needs is in place.");

if (next.length > 0) {
  print("\nNext:");
  next.forEach((step, index) => print(`  ${index + 1}. ${step}`));
}
print();

// Set the exit code and let Node finish by itself. Calling process.exit()
// straight after network requests can crash Node on Windows.
process.exitCode = failed ? 1 : 0;
