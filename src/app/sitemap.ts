import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/**
 * Only the marketing page is listed. Storefronts are discovered through the
 * links retailers share, and each one sets its own canonical URL and metadata.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${siteUrl()}/`, changeFrequency: "weekly", priority: 1 }];
}
