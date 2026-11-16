import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DemoAccounts, SignInForm } from "@/components/auth/auth-forms";
import { AuthShell } from "@/components/auth/auth-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { isDemoMode } from "@/lib/env";
import { DEMO_ACCOUNTS } from "@/server/backend/seed-data";
import { getSessionContext } from "@/server/session";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

type Props = PageProps<"/login">;

export default function LoginPage({ searchParams }: Props) {
  const demo = isDemoMode();
  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to manage your inventory and storefront."
      footer={
        <p>
          New here?{" "}
          <Link href="/signup" className="font-medium text-brand-strong underline-offset-4 hover:underline">
            Create your storefront
          </Link>
        </p>
      }
    >
      <Suspense fallback={<FormFallback />}>
        <SignIn searchParams={searchParams} />
      </Suspense>

      {demo ? (
        <section className="mt-8 border-t pt-6">
          <h2 className="text-sm font-semibold">Just looking? Open a demo shop</h2>
          <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
            The app is running in demo mode with three fictional retailers. One tap signs you in. No password needed.
          </p>
          <div className="mt-3">
            <DemoAccounts accounts={DEMO_ACCOUNTS.map(({ business, email }) => ({ business, email }))} />
          </div>
        </section>
      ) : null}
    </AuthShell>
  );
}

function FormFallback() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-[66px] rounded-md" />
      <Skeleton className="h-[66px] rounded-md" />
      <Skeleton className="mt-1 h-12 rounded-lg" />
    </div>
  );
}

async function SignIn({ searchParams }: Pick<Props, "searchParams">) {
  const params = await searchParams;
  const { user, business } = await getSessionContext();
  if (user) redirect(business ? "/dashboard" : "/onboarding");

  const next = typeof params.next === "string" ? params.next : undefined;
  const failed = typeof params.error === "string" ? params.error : undefined;

  return (
    <>
      {failed ? (
        <p role="alert" className="mb-4 rounded-lg border border-danger/25 bg-danger-soft px-3.5 py-3 text-sm leading-5 text-danger">
          {failed === "rate"
            ? "Too many attempts. Wait a minute and try again."
            : failed === "link_expired"
              ? "That link has expired or was already used. Sign in, or request a new link."
              : "That demo account could not be opened. Run “npm run demo:reset” to restore the demo data."}
        </p>
      ) : null}
      <SignInForm next={next} />
    </>
  );
}
