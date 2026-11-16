import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabaseEnv, type SupabaseEnv } from "@/lib/env";
import { AppError } from "@/server/errors";

/** Public bucket that holds device photos, logos and banners. */
export const IMAGE_BUCKET = "device-images";

export function requireSupabaseEnv(): SupabaseEnv {
  const env = supabaseEnv();
  if (!env) {
    throw new AppError("unavailable", "Supabase is not configured for this deployment.");
  }
  return { url: env.url.replace(/\/+$/, ""), key: env.key };
}

/** "<project url>/storage/v1/object/public/device-images/" */
export function imagePublicBase(env: SupabaseEnv): string {
  return `${env.url.replace(/\/+$/, "")}/storage/v1/object/public/${IMAGE_BUCKET}/`;
}

/**
 * Client bound to the current request's cookies, so it acts as the signed-in
 * user and Row Level Security applies to everything it does.
 *
 * Create one per request and never share it. Server Actions and Route
 * Handlers can write refreshed session cookies; a Server Component render
 * cannot, which is why the proxy refreshes the session before rendering
 * (see ./proxy.ts).
 */
export async function createUserClient(): Promise<SupabaseClient> {
  const env = requireSupabaseEnv();
  const jar = await cookies();

  return createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return jar.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            jar.set(name, value, options);
          }
        } catch {
          // Called while rendering a Server Component, where cookies are
          // read-only. The proxy has already refreshed the session, so there
          // is nothing to lose by skipping the write here.
        }
      },
    },
  });
}

const globalCache = globalThis as unknown as {
  __onhandPublicSupabase?: { key: string; client: SupabaseClient };
};

/**
 * Stateless client for storefront visitors. It never reads or writes cookies,
 * so a public page can never trigger (and then lose) a session refresh, and
 * public data is always fetched as the anon role.
 */
export function createPublicClient(): SupabaseClient {
  const env = requireSupabaseEnv();
  const key = `${env.url}|${env.key}`;
  const cached = globalCache.__onhandPublicSupabase;
  if (cached && cached.key === key) return cached.client;

  const client = createClient(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  globalCache.__onhandPublicSupabase = { key, client };
  return client;
}
