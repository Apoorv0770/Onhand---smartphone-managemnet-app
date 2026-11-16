import type { NextRequest } from "next/server";
import { loadPublicDevices, loadPublicShop } from "@/server/public-data";

/**
 * Public catalog for one storefront. This is the only JSON a customer's
 * browser ever receives, and it is built exclusively from sanitised public
 * shapes: no internal notes, no hidden prices, no database ids.
 */
export async function GET(_request: NextRequest, context: RouteContext<"/api/public/shops/[slug]">) {
  const { slug } = await context.params;
  const shop = await loadPublicShop(slug);
  if (!shop) {
    return Response.json({ error: "Storefront not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const devices = await loadPublicDevices(slug);
  return Response.json({ shop, devices }, { headers: { "Cache-Control": "no-store" } });
}
