"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/env";
import { emailOnlySchema, fieldErrorsOf, newPasswordSchema, profileSchema, signInSchema, signUpSchema } from "@/lib/schemas";
import { siteUrl } from "@/lib/site";
import type { ActionResult } from "@/lib/types";
import { getBackend } from "@/server/backend";
import { clientKey, rateLimit } from "@/server/rate-limit";
import { requireUser } from "@/server/session";
import { parse, run } from "./run";

export interface AuthFormState {
  error?: string;
  notice?: string;
  fieldErrors?: Record<string, string>;
  /** Echoed back so the form keeps what was typed (never the password). */
  values?: { name?: string; email?: string };
}

/** Only ever redirect to a path on this site. */
function safeNext(value: FormDataEntryValue | null, fallback: string): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}

async function tooManyAttempts(scope: string, identity: string): Promise<boolean> {
  const key = clientKey(await headers());
  return !rateLimit(`${scope}:${key}:${identity}`, 8, 60_000);
}

export async function signInAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = { email: String(formData.get("email") ?? ""), password: String(formData.get("password") ?? "") };
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error), values: { email: raw.email } };
  }
  if (await tooManyAttempts("signin", parsed.data.email)) {
    return { error: "Too many attempts. Wait a minute and try again.", values: { email: raw.email } };
  }

  const backend = await getBackend();
  const result = await backend.auth.signIn(parsed.data);
  if (!result.ok) return { error: result.error, values: { email: raw.email } };

  const business = await backend.getBusinessForUser(result.user.id);
  redirect(business ? safeNext(formData.get("next"), "/dashboard") : "/onboarding");
}

export async function signUpAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };
  const values = { name: raw.name, email: raw.email };
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };
  if (await tooManyAttempts("signup", "any")) {
    return { error: "Too many attempts. Wait a minute and try again.", values };
  }

  const backend = await getBackend();
  const result = await backend.auth.signUp(parsed.data);
  if (!result.ok) {
    return result.field
      ? { fieldErrors: { [result.field]: result.error }, values }
      : { error: result.error, values };
  }
  if (result.pendingConfirmation) {
    return {
      notice: `We sent a confirmation link to ${parsed.data.email}. Open it to finish creating your account.`,
      values,
    };
  }
  redirect("/onboarding");
}

/**
 * One-click sign-in for the seeded demo retailers. The password is applied on
 * the server, so it never has to be shown or typed in the browser.
 */
export async function demoSignInAction(formData: FormData): Promise<void> {
  if (!isDemoMode()) redirect("/login");
  const { DEMO_ACCOUNTS, DEFAULT_DEMO_PASSWORD } = await import("@/server/backend/seed-data");
  const email = String(formData.get("email") ?? "");
  if (!DEMO_ACCOUNTS.some((account) => account.email === email)) redirect("/login");
  if (await tooManyAttempts("demo", email)) redirect("/login?error=rate");

  const backend = await getBackend();
  const password = process.env.DEMO_PASSWORD?.trim() || DEFAULT_DEMO_PASSWORD;
  const result = await backend.auth.signIn({ email, password });
  redirect(result.ok ? "/dashboard" : "/login?error=demo");
}

/**
 * Ends the session. The caller then does a full page load of /login, which
 * also clears any client-side state left over from this user.
 */
export async function signOutAction(): Promise<void> {
  const backend = await getBackend();
  await backend.auth.signOut();
}

export async function requestPasswordResetAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const raw = { email: String(formData.get("email") ?? "") };
  const parsed = emailOnlySchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values: raw };
  if (await tooManyAttempts("reset", parsed.data.email)) {
    return { error: "Too many attempts. Wait a minute and try again.", values: raw };
  }

  const backend = await getBackend();
  const redirectTo = `${siteUrl()}/auth/confirm?next=/reset-password`;
  const { supported } = await backend.auth.requestPasswordReset(parsed.data.email, redirectTo);
  if (!supported) {
    return {
      error: "Password reset emails are not available in demo mode because no email service is connected.",
      values: raw,
    };
  }
  // Same answer whether or not the account exists, so emails cannot be probed.
  return { notice: `If an account exists for ${parsed.data.email}, a reset link is on its way.`, values: raw };
}

export async function updatePasswordAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = newPasswordSchema.safeParse({ password: String(formData.get("password") ?? "") });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const backend = await getBackend();
  const result = await backend.auth.updatePassword(parsed.data.password);
  if (!result.ok) return { error: result.error };
  redirect("/dashboard");
}

export async function updateProfileAction(values: unknown): Promise<ActionResult<{ name: string }>> {
  return run(async () => {
    const user = await requireUser();
    const input = parse(profileSchema, values);
    const backend = await getBackend();
    const updated = await backend.auth.updateProfile(user.id, input);
    refresh();
    return { name: updated.name };
  });
}
