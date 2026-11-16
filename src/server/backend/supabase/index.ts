import "server-only";
import type { AuthError, SupabaseClient, User as SupabaseUser } from "@supabase/supabase-js";
import { cache } from "react";
import { siteUrl } from "@/lib/site";
import type { Business, User } from "@/lib/types";
import { AppError } from "@/server/errors";
import type { AuthResult, Backend } from "../types";
import {
  createPublicClient,
  createUserClient,
  IMAGE_BUCKET,
  imagePublicBase,
  requireSupabaseEnv,
} from "./client";
import { createSupabaseData, type ImageStorage, type RpcClient } from "./data";

/* ---------------------------------------------------------------------------
   Supabase backend: Postgres (through RPC functions guarded by Row Level
   Security), Supabase Auth for accounts and sessions, Supabase Storage for
   images. Only the publishable key is used. There is no service-role key in
   this app, so the database policies are the whole security boundary.
--------------------------------------------------------------------------- */

const MESSAGE = {
  emailTaken: "An account with this email already exists.",
  badCredentials: "Incorrect email or password.",
  confirmEmail: "Please confirm your email address first. Check your inbox for the link.",
  rateLimited: "Too many attempts. Please wait a minute and try again.",
  signUpFailed: "We couldn't create your account. Please try again.",
  signInFailed: "We couldn't sign you in. Please try again.",
  resetFailed: "We couldn't send the reset email. Please try again.",
  linkExpired: "This reset link has expired. Request a new one.",
  passwordFailed: "We couldn't update your password. Please try again.",
} as const;

function isRateLimit(error: AuthError): boolean {
  return (
    error.status === 429 ||
    error.code === "over_email_send_rate_limit" ||
    error.code === "over_request_rate_limit"
  );
}

function toUser(user: SupabaseUser, fallbackName = ""): User {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const name = typeof metadata.name === "string" && metadata.name.trim() ? metadata.name.trim() : fallbackName;
  return { id: user.id, name, email: user.email ?? "", createdAt: user.created_at };
}

function rpcClient(client: SupabaseClient): RpcClient {
  return { rpc: (fn, args) => client.rpc(fn, args ?? {}) };
}

/**
 * Where Supabase should send the browser after an email link is opened.
 * Always our own /auth/confirm route, which sets the session and then moves
 * on to `next`.
 */
function confirmUrl(next: string, origin = siteUrl()): string {
  const url = new URL("/auth/confirm", origin);
  url.searchParams.set("next", next);
  return url.toString();
}

/** Accepts either a plain page URL or an /auth/confirm URL from the caller. */
function nextFromRedirect(redirectTo: string): { origin: string; next: string } {
  try {
    const target = new URL(redirectTo, siteUrl());
    const next =
      target.pathname === "/auth/confirm"
        ? (target.searchParams.get("next") ?? "/reset-password")
        : `${target.pathname}${target.search}`;
    return { origin: target.origin, next: next.startsWith("/") ? next : "/reset-password" };
  } catch {
    return { origin: siteUrl(), next: "/reset-password" };
  }
}

/** Storage errors carry an HTTP status in one of two fields, depending on their kind. */
function storageStatus(error: unknown): number {
  const { status, statusCode } = error as { status?: unknown; statusCode?: unknown };
  return Number(status ?? statusCode ?? 0) || 0;
}

async function buildBackend(): Promise<Backend> {
  const env = requireSupabaseEnv();

  // One cookie-bound client per backend instance, created on first use so
  // public pages that never touch private data never read cookies.
  let userClient: Promise<SupabaseClient> | null = null;
  const getUserClient = () => (userClient ??= createUserClient());

  const storage: ImageStorage = {
    publicBase: imagePublicBase(env),

    async upload(path, image) {
      const client = await getUserClient();
      const { error } = await client.storage.from(IMAGE_BUCKET).upload(path, image.bytes, {
        contentType: image.contentType,
        cacheControl: "31536000",
        upsert: false,
      });
      if (!error) return;

      const status = storageStatus(error);
      const message = error.message ?? "";
      if (status === 401) throw new AppError("unauthenticated", "Please sign in again.");
      if (status === 403 || /row-level security|not authorized|unauthorized/i.test(message)) {
        throw new AppError("forbidden", "You don't have access to this business.");
      }
      if (status === 413 || /maximum allowed size|too large/i.test(message)) {
        throw new AppError("validation", "That image is too large. Use one under 6 MB.");
      }
      if (status === 415 || /mime type/i.test(message)) {
        throw new AppError("validation", "Use a JPG, PNG or WebP image.");
      }
      throw new Error(`Supabase storage upload failed: ${message}`);
    },

    async remove(paths) {
      if (paths.length === 0) return;
      const client = await getUserClient();
      await client.storage.from(IMAGE_BUCKET).remove(paths);
    },
  };

  const data = createSupabaseData({
    user: async () => rpcClient(await getUserClient()),
    anon: () => rpcClient(createPublicClient()),
    storage: () => storage,
  });

  const { account, ...dataMethods } = data;

  // getUser() fetches the profile and the business together. The business is
  // handed to the getBusinessForUser() call that normally follows, once, so a
  // dashboard request costs one round trip here instead of two.
  let prefetched: { userId: string; business: Business | null } | null = null;

  return {
    mode: "supabase",

    auth: {
      async getUser() {
        prefetched = null;
        try {
          const client = await getUserClient();
          // Verifies the access token (locally when the project signs JWTs
          // with asymmetric keys) and refreshes it first if it is about to expire.
          const { data: verified, error } = await client.auth.getClaims();
          if (error || !verified) return null;

          const claims = verified.claims;
          if (!claims.sub || claims.is_anonymous) return null;

          // The profile row is the source of truth for the display name.
          try {
            const context = await account.getContext();
            if (context.profile) {
              prefetched = { userId: context.profile.id, business: context.business };
              return context.profile;
            }
          } catch {
            // Fall through to the token's own claims.
          }
          const metadata = (claims.user_metadata ?? {}) as Record<string, unknown>;
          return {
            id: claims.sub,
            name: typeof metadata.name === "string" ? metadata.name : "",
            email: claims.email ?? "",
            createdAt: new Date((claims.iat ?? 0) * 1000).toISOString(),
          };
        } catch {
          return null;
        }
      },

      async signUp(input): Promise<AuthResult> {
        prefetched = null;
        const client = await getUserClient();
        const { data: result, error } = await client.auth.signUp({
          email: input.email,
          password: input.password,
          options: {
            // Copied into public.profiles by a database trigger.
            data: { name: input.name },
            emailRedirectTo: confirmUrl("/onboarding"),
          },
        });

        if (error) {
          if (error.code === "user_already_exists" || error.code === "email_exists") {
            return { ok: false, error: MESSAGE.emailTaken, field: "email" };
          }
          if (error.code === "weak_password") {
            return { ok: false, error: error.message || "Choose a stronger password.", field: "password" };
          }
          if (error.code === "email_address_invalid" || error.code === "email_address_not_authorized") {
            return { ok: false, error: "That email address can't be used. Try another one.", field: "email" };
          }
          if (error.code === "signup_disabled") {
            return { ok: false, error: "New sign-ups are switched off for this project." };
          }
          if (isRateLimit(error)) return { ok: false, error: MESSAGE.rateLimited };
          return { ok: false, error: MESSAGE.signUpFailed };
        }

        const created = result.user;
        if (!created) return { ok: false, error: MESSAGE.signUpFailed };

        // With email confirmation on, Supabase answers a sign-up for an
        // existing address with a user that has no identities.
        if (!result.session && Array.isArray(created.identities) && created.identities.length === 0) {
          return { ok: false, error: MESSAGE.emailTaken, field: "email" };
        }

        const user = toUser(created, input.name);
        return result.session ? { ok: true, user } : { ok: true, user, pendingConfirmation: true };
      },

      async signIn(input): Promise<AuthResult> {
        prefetched = null;
        const client = await getUserClient();
        const { data: result, error } = await client.auth.signInWithPassword({
          email: input.email,
          password: input.password,
        });

        if (error) {
          if (error.code === "invalid_credentials") return { ok: false, error: MESSAGE.badCredentials };
          if (error.code === "email_not_confirmed") {
            return { ok: false, error: MESSAGE.confirmEmail, field: "email" };
          }
          if (isRateLimit(error)) return { ok: false, error: MESSAGE.rateLimited };
          // Older projects report bad credentials with a plain 400.
          if (error.status === 400) return { ok: false, error: MESSAGE.badCredentials };
          return { ok: false, error: MESSAGE.signInFailed };
        }
        if (!result.user) return { ok: false, error: MESSAGE.signInFailed };
        return { ok: true, user: toUser(result.user) };
      },

      async signOut() {
        prefetched = null;
        const client = await getUserClient();
        // "local" ends this browser's session only, not the user's other devices.
        await client.auth.signOut({ scope: "local" });
      },

      async requestPasswordReset(email, redirectTo) {
        const client = await getUserClient();
        const { origin, next } = nextFromRedirect(redirectTo);
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: confirmUrl(next, origin),
        });
        if (error) {
          throw new AppError("unavailable", isRateLimit(error) ? MESSAGE.rateLimited : MESSAGE.resetFailed);
        }
        // Supabase answers the same way whether or not the address has an
        // account, so this never reveals who is registered.
        return { supported: true };
      },

      async updatePassword(password) {
        const client = await getUserClient();
        const { error } = await client.auth.updateUser({ password });
        if (!error) return { ok: true };
        if (error.code === "same_password") {
          return { ok: false, error: "Choose a password you haven't used before." };
        }
        if (error.code === "weak_password") {
          return { ok: false, error: error.message || "Choose a stronger password." };
        }
        if (error.name === "AuthSessionMissingError" || error.status === 401 || error.status === 403) {
          return { ok: false, error: MESSAGE.linkExpired };
        }
        if (isRateLimit(error)) return { ok: false, error: MESSAGE.rateLimited };
        return { ok: false, error: MESSAGE.passwordFailed };
      },

      async updateProfile(_userId, input) {
        prefetched = null;
        const profile = await account.updateProfile(input.name);
        try {
          // Keep the auth metadata in step so new sessions carry the new name.
          const client = await getUserClient();
          await client.auth.updateUser({ data: { name: profile.name } });
        } catch {
          // The profile row is what the app reads. This copy is best effort.
        }
        return profile;
      },
    },

    ...dataMethods,

    async getBusinessForUser(userId) {
      if (prefetched && prefetched.userId === userId) {
        const { business } = prefetched;
        prefetched = null;
        return business;
      }
      return dataMethods.getBusinessForUser(userId);
    },

    // Anything that changes the business makes a prefetched copy stale.
    async createBusiness(userId, input) {
      prefetched = null;
      return dataMethods.createBusiness(userId, input);
    },

    async updateStorefront(userId, businessId, input) {
      prefetched = null;
      return dataMethods.updateStorefront(userId, businessId, input);
    },

    async completeOnboarding(userId, businessId) {
      prefetched = null;
      return dataMethods.completeOnboarding(userId, businessId);
    },
  };
}

/**
 * The Supabase backend for the current request.
 * Memoised per render so one request shares one client and one session read.
 */
export const createSupabaseBackend = cache(buildBackend);
