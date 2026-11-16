import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/shop/"],
        disallow: ["/dashboard", "/onboarding", "/api/", "/auth/", "/login", "/signup", "/forgot-password", "/reset-password"],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
