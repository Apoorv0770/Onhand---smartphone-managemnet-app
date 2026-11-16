import type { NextConfig } from "next";

/*
 * Response headers sent with every route.
 *
 * There is deliberately no script-src policy. A strict one needs a fresh nonce
 * on every request, which would switch off the prerendered page shells
 * (Cache Components). Everything below costs nothing at render time.
 */
const securityHeaders = [
  // Only this site may show these pages inside a frame. The onboarding preview
  // and the demo on the home page do exactly that, so "deny" would break them.
  // Both headers say the same thing: older browsers read the first one.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
  // Browsers must use the declared file type instead of guessing one, which
  // matters for files that retailers upload.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Other sites learn which site a visitor came from, never the full address.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Device features the app never asks for. Choosing a photo goes through the
  // file picker, which is not affected by this.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// Tells browsers to keep using HTTPS for this host for a year. Browsers ignore
// it over plain HTTP, so it only takes effect once the app is served securely,
// and it is left out of development altogether.
const transportHeaders =
  process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : [];

/*
 * Settings that would produce a Vercel deployment which builds, looks fine and
 * does not work. Stopping the build with a plain explanation is kinder than
 * publishing that. Nothing here runs outside Vercel.
 */
function assertVercelSettings(): void {
  if (process.env.VERCEL !== "1") return;

  const problems: string[] = [];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseKey = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();
  if (!supabaseUrl || !supabaseKey) {
    problems.push(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must both be set. Without them the app " +
        "falls back to demo mode, which keeps its data in local files and cannot work on Vercel.",
    );
  }
  if (process.env.ONHAND_FORCE_DEMO === "1") {
    problems.push("ONHAND_FORCE_DEMO must not be set. It forces demo mode, which cannot work on Vercel.");
  }
  if (process.env.ONHAND_DIST_DIR?.trim()) {
    problems.push("ONHAND_DIST_DIR must not be set. Vercel expects the build in the default folder.");
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (siteUrl && !/^https:\/\/(?!localhost\b|127\.0\.0\.1\b|\[::1\])/i.test(siteUrl)) {
    problems.push(
      "NEXT_PUBLIC_SITE_URL must be the public https address of this site, or be left out so the Vercel address " +
        "is used. It currently points somewhere else, such as this computer.",
    );
  }

  if (problems.length > 0) {
    throw new Error(
      `Onhand is not set up correctly for Vercel:\n- ${problems.join("\n- ")}\n` +
        "Fix these under Project Settings, Environment Variables, then redeploy.",
    );
  }
}

assertVercelSettings();

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // A second server (for example the end-to-end test server) can run from the
  // same folder by pointing this at its own output directory.
  distDir: process.env.ONHAND_DIST_DIR?.trim() || ".next",
  async headers() {
    return [{ source: "/:path*", headers: [...securityHeaders, ...transportHeaders] }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
