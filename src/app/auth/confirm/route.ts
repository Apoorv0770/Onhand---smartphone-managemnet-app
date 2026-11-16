import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/lib/env";
import { createUserClient } from "@/server/backend/supabase/client";

/* ---------------------------------------------------------------------------
   Landing point for links in Supabase emails (confirm sign-up, reset password).

   Two link styles are handled:
     ?token_hash=...&type=...   the recommended email templates (work on any
                                device, see README > Connecting Supabase)
     ?code=...                  Supabase's default templates (PKCE: only works
                                in the browser that asked for the email)

   On success the session cookies are set and the visitor moves on to `next`.
   `next` must be a path on this site, so the link can never be turned into a
   redirect to somewhere else.
--------------------------------------------------------------------------- */

const OTP_TYPES: readonly EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

function isOtpType(value: string | null): value is EmailOtpType {
  return value !== null && (OTP_TYPES as readonly string[]).includes(value);
}

/** A same-site path, or the fallback. Rejects absolute and protocol-relative URLs. */
function safePath(value: string | null, fallback: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  try {
    const parsed = new URL(value, "http://onhand.invalid");
    if (parsed.origin !== "http://onhand.invalid") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

/** The origin the visitor actually used, including behind a reverse proxy. */
function publicOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost && process.env.NODE_ENV !== "development") {
    const protocol = request.headers.get("x-forwarded-proto") ?? "https";
    return `${protocol}://${forwardedHost}`;
  }
  return request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const origin = publicOrigin(request);
  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  const code = params.get("code");
  const isRecovery = type === "recovery";

  if (isDemoMode()) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  const next = safePath(params.get("next"), isRecovery ? "/reset-password" : "/dashboard");
  const failure = new URL(isRecovery || next.startsWith("/reset-password") ? "/forgot-password" : "/login", origin);
  failure.searchParams.set("error", "link_expired");

  try {
    const supabase = await createUserClient();

    if (tokenHash && isOtpType(type)) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      if (!error) return NextResponse.redirect(new URL(next, origin));
    } else if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(next, origin));
    }
  } catch {
    // Fall through to the failure redirect.
  }

  return NextResponse.redirect(failure);
}
