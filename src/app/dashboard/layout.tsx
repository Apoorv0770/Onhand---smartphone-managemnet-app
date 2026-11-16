import type { Metadata } from "next";
import { Suspense } from "react";
import { BusinessBadge, DemoModeBadge, MobileBusinessBadge, StorefrontShortcut } from "@/components/dashboard/identity";
import { AccountMenu, DashboardShell } from "@/components/dashboard/shell";
import { Skeleton } from "@/components/ui/skeleton";
import { isDemoMode } from "@/lib/env";
import { site } from "@/lib/site";
import { requireBusiness } from "@/server/session";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: `%s · ${site.name}` },
  robots: { index: false, follow: false },
};

/*
 * The shell (sidebar, top bar, navigation) is static and paints immediately.
 * Anything that depends on who is signed in streams into its own boundary, and
 * each of those calls requireBusiness(), which sends signed-out visitors to
 * /login and retailers without a storefront to /onboarding.
 */

async function Identity() {
  const { business } = await requireBusiness();
  return <BusinessBadge name={business.name} slug={business.slug} logoUrl={business.logoUrl} />;
}

async function MobileIdentity() {
  const { business } = await requireBusiness();
  return <MobileBusinessBadge name={business.name} slug={business.slug} logoUrl={business.logoUrl} />;
}

async function Shortcut() {
  const { business } = await requireBusiness();
  return <StorefrontShortcut slug={business.slug} />;
}

async function Account() {
  const { user } = await requireBusiness();
  return <AccountMenu name={user.name} email={user.email} />;
}

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <DashboardShell
      identity={
        <Suspense fallback={<Skeleton className="h-[54px] rounded-lg" />}>
          <Identity />
        </Suspense>
      }
      mobileIdentity={
        <Suspense fallback={<Skeleton className="h-8 w-40 rounded-lg" />}>
          <MobileIdentity />
        </Suspense>
      }
      storefrontLink={
        <Suspense fallback={<Skeleton className="h-8 w-28 rounded-sm" />}>
          <Shortcut />
        </Suspense>
      }
      account={
        <Suspense fallback={<Skeleton className="h-11 rounded-md" />}>
          <Account />
        </Suspense>
      }
      badge={isDemoMode() ? <DemoModeBadge /> : null}
    >
      {children}
    </DashboardShell>
  );
}
