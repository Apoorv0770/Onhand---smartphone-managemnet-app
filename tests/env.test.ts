import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { isDemoMode, isSecretSupabaseKey, supabaseEnv, supabaseProjectRef } from "@/lib/env";
import { siteUrl } from "@/lib/site";

/**
 * The guards that decide which backend the app talks to. They are the last line
 * of defence against pointing the app at the wrong Supabase project or shipping
 * a secret key in a public variable, so each one is pinned down here.
 *
 * All values are made up. Nothing in this file contacts a network.
 */

const NAMES = [
  "ONHAND_FORCE_DEMO",
  "ONHAND_SUPABASE_PROJECT_REF",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL",
] as const;

const REF = "abcdefghijklmnopqrst";
const OTHER_REF = "zyxwvutsrqponmlkjihg";
const URL_FOR = (ref: string) => `https://${ref}.supabase.co`;
const PUBLISHABLE = "sb_publishable_example_value";

/** A structurally valid, unsigned token carrying the given role. */
function legacyKey(role: string, ref = REF): string {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "HS256", typ: "JWT" })}.${part({ iss: "supabase", ref, role })}.signature`;
}

let saved: Partial<Record<(typeof NAMES)[number], string | undefined>> = {};

beforeEach(() => {
  saved = {};
  for (const name of NAMES) {
    saved[name] = process.env[name];
    delete process.env[name];
  }
});

afterEach(() => {
  for (const name of NAMES) {
    const value = saved[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("siteUrl", () => {
  it("is localhost on a machine with nothing configured", () => {
    expect(siteUrl()).toBe("http://localhost:3000");
  });

  it("uses the configured address, without trailing slashes or spaces", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "  https://shops.example.com//  ";
    expect(siteUrl()).toBe("https://shops.example.com");
  });

  it("uses the address Vercel reports when none is configured, over https", () => {
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL = "onhand-demo.vercel.app";
    expect(siteUrl()).toBe("https://onhand-demo.vercel.app");
  });

  it("prefers the configured address to the one Vercel reports", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://shops.example.com";
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL = "onhand-demo.vercel.app";
    expect(siteUrl()).toBe("https://shops.example.com");
  });

  it("ignores an empty configured address", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "   ";
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL = "onhand-demo.vercel.app";
    expect(siteUrl()).toBe("https://onhand-demo.vercel.app");
  });
});

describe("supabaseProjectRef", () => {
  it("reads the ref from a project URL", () => {
    expect(supabaseProjectRef(URL_FOR(REF))).toBe(REF);
    expect(supabaseProjectRef(`${URL_FOR(REF)}/`)).toBe(REF);
  });

  it("returns null for anything that is not a Supabase project host", () => {
    expect(supabaseProjectRef("https://api.example.com")).toBeNull();
    expect(supabaseProjectRef(`https://${REF}.supabase.co.example.com`)).toBeNull();
    expect(supabaseProjectRef("not a url")).toBeNull();
    expect(supabaseProjectRef("")).toBeNull();
  });
});

describe("isSecretSupabaseKey", () => {
  it("accepts publishable and legacy anon keys", () => {
    expect(isSecretSupabaseKey(PUBLISHABLE)).toBe(false);
    expect(isSecretSupabaseKey(legacyKey("anon"))).toBe(false);
  });

  it("rejects secret and service-role keys", () => {
    expect(isSecretSupabaseKey("sb_secret_example_value")).toBe(true);
    expect(isSecretSupabaseKey(legacyKey("service_role"))).toBe(true);
  });

  it("does not choke on text that only looks like a token", () => {
    expect(isSecretSupabaseKey("a.b.c")).toBe(false);
    expect(isSecretSupabaseKey("")).toBe(false);
  });
});

describe("supabaseEnv", () => {
  it("is demo mode when nothing is configured", () => {
    expect(supabaseEnv()).toBeNull();
    expect(isDemoMode()).toBe(true);
  });

  it("stays in demo mode while the key is still empty", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = URL_FOR(REF);
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "";
    process.env.ONHAND_SUPABASE_PROJECT_REF = REF;
    expect(supabaseEnv()).toBeNull();
    expect(isDemoMode()).toBe(true);
  });

  it("stays in demo mode when only the key is set", () => {
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = PUBLISHABLE;
    expect(supabaseEnv()).toBeNull();
  });

  it("returns the trimmed URL and key once both are set", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = `  ${URL_FOR(REF)}  `;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = ` ${PUBLISHABLE} `;
    expect(supabaseEnv()).toEqual({ url: URL_FOR(REF), key: PUBLISHABLE });
    expect(isDemoMode()).toBe(false);
  });

  it("falls back to the legacy anon key variable", () => {
    const anon = legacyKey("anon");
    process.env.NEXT_PUBLIC_SUPABASE_URL = URL_FOR(REF);
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = anon;
    expect(supabaseEnv()).toEqual({ url: URL_FOR(REF), key: anon });
  });

  it("lets ONHAND_FORCE_DEMO override a complete configuration", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = URL_FOR(REF);
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = PUBLISHABLE;
    process.env.ONHAND_FORCE_DEMO = "1";
    expect(supabaseEnv()).toBeNull();
    expect(isDemoMode()).toBe(true);
  });

  it("connects when the URL matches the project lock", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = URL_FOR(REF);
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = PUBLISHABLE;
    process.env.ONHAND_SUPABASE_PROJECT_REF = REF;
    expect(supabaseEnv()).toEqual({ url: URL_FOR(REF), key: PUBLISHABLE });
  });

  it("refuses a URL that points at a different project than the lock", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = URL_FOR(OTHER_REF);
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = PUBLISHABLE;
    process.env.ONHAND_SUPABASE_PROJECT_REF = REF;
    expect(() => supabaseEnv()).toThrow(/Refusing to connect to a different project/);
    expect(() => isDemoMode()).toThrow();
  });

  it("refuses a non-Supabase URL while the lock is set", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://api.example.com";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = PUBLISHABLE;
    process.env.ONHAND_SUPABASE_PROJECT_REF = REF;
    expect(() => supabaseEnv()).toThrow(/Refusing to connect/);
  });

  it("refuses a secret key in the publishable variable, without echoing it", () => {
    const secret = "sb_secret_example_value";
    process.env.NEXT_PUBLIC_SUPABASE_URL = URL_FOR(REF);
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = secret;
    let message = "";
    try {
      supabaseEnv();
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toMatch(/secret or service-role key/);
    expect(message).not.toContain(secret);
  });

  it("refuses a legacy service-role key", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = URL_FOR(REF);
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = legacyKey("service_role");
    expect(() => supabaseEnv()).toThrow(/secret or service-role key/);
  });
});
