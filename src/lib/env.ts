/** Name of the httpOnly cookie that holds a demo-mode session token. */
export const SESSION_COOKIE = "onhand_session";

export interface SupabaseEnv {
  url: string;
  key: string;
}

/** The project ref in "https://<ref>.supabase.co", or null for any other host. */
export function supabaseProjectRef(url: string): string | null {
  try {
    const match = /^([a-z0-9]{10,40})\.supabase\.(co|in|net)$/.exec(new URL(url).hostname);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * True for keys that must never sit in a NEXT_PUBLIC variable: the new
 * "sb_secret_" keys and the legacy service_role JWT. Decided locally from the
 * key's shape; nothing is sent anywhere.
 */
export function isSecretSupabaseKey(key: string): boolean {
  if (key.startsWith("sb_secret_")) return true;
  const parts = key.split(".");
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))) as { role?: unknown };
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

/**
 * Supabase credentials when configured, otherwise null (demo mode).
 * Only ever called on the server.
 *
 * Three guards, each failing closed:
 * - `ONHAND_FORCE_DEMO=1` wins over everything, so automated tests can never
 *   reach a real project even when `.env.local` points at one.
 * - `ONHAND_SUPABASE_PROJECT_REF`, when set, must match the project in the URL.
 *   The app refuses to talk to any other Supabase project.
 * - A secret or service-role key in the publishable-key variable is rejected.
 */
export function supabaseEnv(): SupabaseEnv | null {
  if (process.env.ONHAND_FORCE_DEMO === "1") return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();
  if (!url || !key) return null;

  const expectedRef = process.env.ONHAND_SUPABASE_PROJECT_REF?.trim();
  if (expectedRef && supabaseProjectRef(url) !== expectedRef) {
    throw new Error(
      `Supabase is misconfigured: NEXT_PUBLIC_SUPABASE_URL does not point at project "${expectedRef}" ` +
        "(ONHAND_SUPABASE_PROJECT_REF). Refusing to connect to a different project.",
    );
  }
  if (isSecretSupabaseKey(key)) {
    throw new Error(
      "Supabase is misconfigured: a secret or service-role key was placed in NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
        "Replace it with the publishable key and rotate the secret key in the Supabase dashboard.",
    );
  }
  return { url, key };
}

/** True when the app runs on the local demo database instead of Supabase. */
export function isDemoMode(): boolean {
  return supabaseEnv() === null;
}
