import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode, SESSION_COOKIE } from "@/lib/env";
import { refreshSupabaseSession, withSupabaseCookies } from "@/server/backend/supabase/proxy";

/* ---------------------------------------------------------------------------
   Runs before the routes below render.

   It is an optimistic gate only: it turns signed-out visitors away from the
   dashboard before any shell is sent, so they never see it flash. The real
   authorisation happens next to the data, in requireBusiness() and in every
   server action, and (with Supabase) again in the database's own policies.

   In Supabase mode this is also where short-lived session tokens are refreshed,
   which is why the auth pages are matched too.
--------------------------------------------------------------------------- */

const PROTECTED = ["/dashboard", "/onboarding"];

function loginRedirect(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  url.pathname = "/login";
  url.search = "";
  if (next !== "/dashboard") url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsSession = PROTECTED.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (isDemoMode()) {
    if (needsSession && !request.cookies.has(SESSION_COOKIE)) return loginRedirect(request);
    return NextResponse.next();
  }

  const { response, isAuthenticated } = await refreshSupabaseSession(request);
  if (needsSession && !isAuthenticated) {
    return withSupabaseCookies(response, loginRedirect(request));
  }
  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
  ],
};
