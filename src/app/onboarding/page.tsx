import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { SignOutButton } from "@/components/dashboard/shell";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";
import { site } from "@/lib/site";
import { getBackend } from "@/server/backend";
import { getSessionContext, requireUser } from "@/server/session";

export const metadata: Metadata = {
  title: "Set up your storefront",
  robots: { index: false, follow: false },
};

export default function OnboardingPage() {
  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <header className="container-page flex h-16 items-center justify-between">
        <Link href="/" aria-label={`${site.name} home`} className="rounded-md">
          <Logo />
        </Link>
        <SignOutButton className="h-9 border-transparent bg-transparent px-3 text-[13px] shadow-none hover:border-transparent hover:bg-surface-3" />
      </header>
      <main className="container-page flex-1 pb-20 pt-6 sm:pt-10">
        <Suspense
          fallback={
            <LoadingRegion label="Loading setup" className="mx-auto grid w-full max-w-xl gap-6">
              <Skeleton className="h-1 w-full" />
              <Skeleton className="mt-6 h-9 w-4/5" />
              <Skeleton className="h-5 w-3/5" />
              <Skeleton className="h-11 rounded-md" />
              <Skeleton className="h-11 rounded-md" />
              <Skeleton className="h-11 rounded-md" />
            </LoadingRegion>
          }
        >
          <Onboarding />
        </Suspense>
      </main>
    </div>
  );
}

async function Onboarding() {
  const user = await requireUser();
  const { business } = await getSessionContext();
  if (business?.settings.onboardingCompletedAt) redirect("/dashboard");

  let hasDevice = false;
  if (business) {
    const backend = await getBackend();
    hasDevice = (await backend.listDevices(user.id, business.id)).length > 0;
  }

  return (
    <OnboardingFlow
      userName={user.name}
      hasDevice={hasDevice}
      business={
        business
          ? {
              name: business.name,
              slug: business.slug,
              showPricesByDefault: business.settings.showPricesByDefault,
            }
          : null
      }
    />
  );
}
