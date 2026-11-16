import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "@/lib/env";

/* ---------------------------------------------------------------------------
   Session refresh for the Next.js proxy (Supabase mode only).

   Supabase access tokens are short-lived and refresh tokens are single-use.
   A Server Component cannot write cookies, so a refresh that happens while
   rendering would be lost and the user signed out on their next request.
   Running this in the proxy refreshes the session before rendering starts and
   writes the new cookies to both the forwarded request and the response.

   Call it for every route that reads the session while rendering: the
   dashboard, onboarding and the auth pages.
--------------------------------------------------------------------------- */

export interface SupabaseSessionResult {
  /** Continue with this response. It carries any refreshed session cookies. */
  response: NextResponse;
  /** Whether the request has a valid, verified session. */
  isAuthenticated: boolean;
}

export async function refreshSupabaseSession(request: NextRequest): Promise<SupabaseSessionResult> {
  let response = NextResponse.next({ request });

  const env = supabaseEnv();
  if (!env) return { response, isAuthenticated: false };

  const supabase = createServerClient(env.url.replace(/\/+$/, ""), env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        // Make the fresh tokens visible to the Server Components that render next...
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        // ...and send them to the browser.
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Responses that set auth cookies must never be cached and shared.
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  try {
    // Do not run anything between creating the client and this call: it is
    // what loads the session and refreshes it when it is about to expire.
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims;
    return { response, isAuthenticated: Boolean(claims?.sub) && !claims?.is_anonymous };
  } catch {
    return { response, isAuthenticated: false };
  }
}

/**
 * Copies session cookies onto another response. Use it when the proxy
 * answers with a redirect instead of `response`, so a refresh is not lost.
 */
export function withSupabaseCookies(from: NextResponse, to: NextResponse): NextResponse {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = from.headers.get(header);
    if (value) to.headers.set(header, value);
  }
  return to;
}
