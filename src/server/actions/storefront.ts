"use server";

import { refresh } from "next/cache";
import { businessFormSchema, slugSchema, storefrontFormSchema } from "@/lib/schemas";
import type { ActionResult, BusinessInput, StorefrontSettingsInput } from "@/lib/types";
import { normaliseIndianMobile, normaliseInstagramHandle } from "@/lib/whatsapp";
import { getBackend } from "@/server/backend";
import { AppError } from "@/server/errors";
import { getSessionContext, requireBusiness, requireUser } from "@/server/session";
import { parse, run } from "./run";

function toBusinessInput(values: {
  name: string;
  slug: string;
  description: string;
  location: string;
  whatsappNumber: string;
  phoneNumber: string;
  instagramHandle: string;
}): BusinessInput {
  const whatsappNumber = normaliseIndianMobile(values.whatsappNumber);
  if (!whatsappNumber) {
    throw new AppError("validation", "Please check the highlighted fields.", {
      whatsappNumber: "Enter a valid 10-digit Indian mobile number",
    });
  }
  return {
    name: values.name,
    slug: values.slug,
    description: values.description,
    location: values.location,
    whatsappNumber,
    phoneNumber: values.phoneNumber ? normaliseIndianMobile(values.phoneNumber) : null,
    instagramHandle: values.instagramHandle ? normaliseInstagramHandle(values.instagramHandle) : null,
  };
}

/** Live check used while a retailer types their storefront address. */
export async function checkSlugAction(
  candidate: string,
): Promise<{ available: boolean; slug: string; message?: string }> {
  const { user, business } = await getSessionContext();
  if (!user) return { available: false, slug: candidate, message: "Please sign in again." };

  const result = slugSchema.safeParse(candidate);
  if (!result.success) {
    return { available: false, slug: candidate, message: result.error.issues[0]?.message ?? "Invalid address" };
  }
  const backend = await getBackend();
  const available = await backend.isSlugAvailable(result.data, business?.id);
  return {
    available,
    slug: result.data,
    message: available ? undefined : "That address is already taken.",
  };
}

/** Onboarding: creates the retailer's business and its storefront address. */
export async function createBusinessAction(values: unknown): Promise<ActionResult<{ slug: string }>> {
  return run(async () => {
    const user = await requireUser();
    const input = toBusinessInput(parse(businessFormSchema, values));
    const backend = await getBackend();
    const business = await backend.createBusiness(user.id, input);
    refresh();
    return { slug: business.slug };
  });
}

export async function completeOnboardingAction(): Promise<ActionResult<{ slug: string }>> {
  return run(async () => {
    const { user, business } = await requireBusiness();
    const backend = await getBackend();
    const updated = await backend.completeOnboarding(user.id, business.id);
    refresh();
    return { slug: updated.slug };
  });
}

export async function updateStorefrontAction(values: unknown): Promise<ActionResult<{ slug: string }>> {
  return run(async () => {
    const { user, business } = await requireBusiness();
    const form = parse(storefrontFormSchema, values);
    const input: StorefrontSettingsInput = {
      ...toBusinessInput(form),
      logoUrl: form.logoUrl,
      bannerUrl: form.bannerUrl,
      coverStyle: form.coverStyle,
      hours: form.hoursEnabled ? form.hours : null,
      showPricesByDefault: form.showPricesByDefault,
      showSoldDevices: form.showSoldDevices,
    };
    const backend = await getBackend();
    const updated = await backend.updateStorefront(user.id, business.id, input);
    refresh();
    return { slug: updated.slug };
  });
}
