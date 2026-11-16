import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SignUpForm } from "@/components/auth/auth-forms";
import { AuthShell } from "@/components/auth/auth-shell";
import { isDemoMode } from "@/lib/env";
import { getSessionContext } from "@/server/session";

export const metadata: Metadata = {
  title: "Create your storefront",
  description: "Create an account, name your shop and share your catalog link in a few minutes.",
};

export default function SignUpPage() {
  return (
    <AuthShell
      title="Create your storefront"
      description="Start with an account. Next you will name your shop and choose its link."
      footer={
        <p>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brand-strong underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
      <SignUpForm />
      {isDemoMode() ? (
        <p className="mt-5 rounded-lg bg-surface-2 px-3.5 py-3 text-[13px] leading-5 text-muted-foreground">
          <span className="font-medium text-foreground">Demo mode.</span> Your account and shop are saved on this
          machine only, in the project&apos;s <code className="font-mono text-xs">.data</code> folder.
        </p>
      ) : null}
    </AuthShell>
  );
}

async function RedirectIfSignedIn() {
  const { user, business } = await getSessionContext();
  if (user) redirect(business ? "/dashboard" : "/onboarding");
  return null;
}
