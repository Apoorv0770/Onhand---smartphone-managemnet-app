/**
 * Product identity lives here so the working name can be changed in one place.
 */
export const site = {
  name: "Onhand",
  tagline: "Your inventory. Always within reach.",
  description:
    "Onhand gives second-hand smartphone retailers a shareable, always up-to-date catalog of the phones they have in stock, so customers can browse instead of asking.",
  demoShopSlug: "urban-mobile-studio",
} as const;

/**
 * The public address of this deployment, without a trailing slash. Used for
 * canonical links, the sitemap, share links rendered on the server and the
 * links in account emails.
 *
 * `NEXT_PUBLIC_SITE_URL` wins when it is set. On Vercel the project's public
 * address is known while building, so a deployment there needs no setting at
 * all. Only a machine with neither falls back to localhost.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  // Set by Vercel: the project's production domain, without "https://".
  const vercelHost = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const raw = explicit || (vercelHost ? `https://${vercelHost}` : "http://localhost:3000");
  return raw.replace(/\/+$/, "");
}

export function shopPath(slug: string): string {
  return `/shop/${slug}`;
}
