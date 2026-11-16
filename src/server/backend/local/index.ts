import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/env";
import { siteUrl } from "@/lib/site";
import { isAppError } from "@/server/errors";
import type { AuthResult, Backend } from "../types";
import * as store from "./store";

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

async function startSession(userId: string): Promise<void> {
  const token = store.createSession(userId);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: siteUrl().startsWith("https://"),
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/**
 * Demo-mode backend: a JSON database and uploaded images under ./.data.
 * Real sessions, real password hashing and real server-side authorisation,
 * just without an external service.
 */
export const localBackend: Backend = {
  mode: "local",

  auth: {
    async getUser() {
      const token = (await cookies()).get(SESSION_COOKIE)?.value;
      return token ? store.getUserBySession(token) : null;
    },

    async signUp(input): Promise<AuthResult> {
      try {
        const user = store.createUser(input);
        await startSession(user.id);
        return { ok: true, user };
      } catch (error) {
        if (isAppError(error) && error.code === "conflict") {
          return { ok: false, error: error.message, field: "email" };
        }
        throw error;
      }
    },

    async signIn(input): Promise<AuthResult> {
      const user = store.verifyCredentials(input.email, input.password);
      if (!user) return { ok: false, error: "Incorrect email or password." };
      await startSession(user.id);
      return { ok: true, user };
    },

    async signOut() {
      const jar = await cookies();
      const token = jar.get(SESSION_COOKIE)?.value;
      if (token) store.deleteSession(token);
      jar.delete(SESSION_COOKIE);
    },

    async requestPasswordReset() {
      // Demo mode has no email service, so there is nothing to send.
      return { supported: false };
    },

    async updatePassword() {
      return { ok: false, error: "Password reset emails are not available in demo mode." };
    },

    async updateProfile(userId, input) {
      return store.updateUser(userId, input);
    },
  },

  async getBusinessForUser(userId) {
    return store.getBusinessForUser(userId);
  },
  async createBusiness(userId, input) {
    return store.createBusiness(userId, input);
  },
  async updateStorefront(userId, businessId, input) {
    return store.updateStorefront(userId, businessId, input);
  },
  async completeOnboarding(userId, businessId) {
    return store.completeOnboarding(userId, businessId);
  },
  async isSlugAvailable(slug, exceptBusinessId) {
    return store.isSlugAvailable(slug, exceptBusinessId);
  },

  async listDevices(userId, businessId) {
    return store.listDevices(userId, businessId);
  },
  async getDevice(userId, businessId, deviceId) {
    return store.getDevice(userId, businessId, deviceId);
  },
  async createDevice(userId, businessId, input) {
    return store.createDevice(userId, businessId, input);
  },
  async updateDevice(userId, businessId, deviceId, input) {
    return store.updateDevice(userId, businessId, deviceId, input);
  },
  async setAvailability(userId, businessId, deviceId, status) {
    return store.setAvailability(userId, businessId, deviceId, status);
  },
  async setPriceVisibility(userId, businessId, deviceId, showPrice) {
    return store.setPriceVisibility(userId, businessId, deviceId, showPrice);
  },
  async deleteDevice(userId, businessId, deviceId) {
    store.deleteDevice(userId, businessId, deviceId);
  },
  async suggestReference(userId, businessId) {
    return store.suggestReference(userId, businessId);
  },

  async saveImage(userId, businessId, image) {
    return store.saveImage(userId, businessId, image);
  },

  async listActivity(userId, businessId, limit) {
    return store.listActivity(userId, businessId, limit);
  },
  async getAnalytics(userId, businessId, days) {
    return store.getAnalytics(userId, businessId, days);
  },
  async recordEvent(slug, type, deviceShortId) {
    store.recordEvent(slug, type, deviceShortId);
  },

  async getPublicShop(slug) {
    return store.getPublicShop(slug);
  },
  async listPublicDevices(slug) {
    return store.listPublicDevices(slug);
  },
  async getPublicDevice(slug, shortId) {
    return store.getPublicDevice(slug, shortId);
  },
};
