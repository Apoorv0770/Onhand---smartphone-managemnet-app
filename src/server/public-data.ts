import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import type { PublicDevice, PublicShop } from "@/lib/types";
import { getBackend } from "@/server/backend";

/* ---------------------------------------------------------------------------
   Read-only storefront data. Every function here returns sanitised public
   shapes and is memoised per request, so metadata and the page share a lookup.
   Nothing is cached across requests: customers always see current stock.
--------------------------------------------------------------------------- */

export const loadPublicShop = cache(async (slug: string): Promise<PublicShop | null> => {
  // Storefront data is always read at request time, never during prerender.
  await connection();
  const backend = await getBackend();
  return backend.getPublicShop(slug.toLowerCase());
});

export const loadPublicDevices = cache(async (slug: string): Promise<PublicDevice[]> => {
  // Storefront data is always read at request time, never during prerender.
  await connection();
  const backend = await getBackend();
  return backend.listPublicDevices(slug.toLowerCase());
});

export const loadPublicDevice = cache(async (slug: string, shortId: string): Promise<PublicDevice | null> => {
  // Storefront data is always read at request time, never during prerender.
  await connection();
  const backend = await getBackend();
  return backend.getPublicDevice(slug.toLowerCase(), shortId);
});

/** JSON-LD needs "<" escaped so it can never close its script tag early. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
