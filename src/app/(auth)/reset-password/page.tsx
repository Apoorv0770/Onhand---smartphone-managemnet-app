import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/auth-forms";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessionContext } from "@/server/session";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Choose a new password"
      description="You opened a password reset link. Set a new password to get back into your dashboard."
    >
      <Suspense fallback={<Skeleton className="h-36 rounded-md" />}>
        <Reset />
      </Suspense>
    </AuthShell>
  );
}

/** The reset link signs the visitor in first. Without that session there is nothing to update. */
async function Reset() {
  const { user } = await getSessionContext();
  if (!user) {
    return (
      <div className="grid gap-4">
        <p role="alert" className="rounded-lg border border-danger/25 bg-danger-soft px-3.5 py-3 text-sm leading-5 text-danger">
          This reset link has expired or was already used. Request a new one to continue.
        </p>
        <Button asChild size="lg">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    );
  }
  return <ResetPasswordForm />;
}
