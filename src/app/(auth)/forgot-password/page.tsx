import { Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";
import { AuthShell } from "@/components/auth/auth-shell";
import { isDemoMode } from "@/lib/env";

export const metadata: Metadata = {
  title: "Reset your password",
  robots: { index: false, follow: false },
};

type Props = PageProps<"/forgot-password">;

/** Shown when a reset link was opened after it expired or had been used. */
async function ExpiredNotice({ searchParams }: Pick<Props, "searchParams">) {
  const params = await searchParams;
  if (params.error !== "link_expired") return null;
  return (
    <p role="alert" className="mb-5 rounded-lg border border-danger/25 bg-danger-soft px-3.5 py-3 text-sm leading-5 text-danger">
      That reset link has expired or was already used. Enter your email to get a new one.
    </p>
  );
}

export default function ForgotPasswordPage({ searchParams }: Props) {
  const demo = isDemoMode();
  return (
    <AuthShell
      title="Reset your password"
      description="Enter the email you signed up with and we will send you a link to choose a new password."
      footer={
        <p>
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-brand-strong underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </p>
      }
    >
      <Suspense fallback={null}>
        <ExpiredNotice searchParams={searchParams} />
      </Suspense>
      {demo ? (
        <div className="mb-5 flex items-start gap-2.5 rounded-lg border bg-surface-2 px-3.5 py-3 text-[13px] leading-5 text-muted-foreground">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p>
            <span className="font-medium text-foreground">Not available in demo mode.</span> Reset emails are sent by
            Supabase Auth, which is not connected here. Use a demo shop from the sign-in page, or create a new account.
          </p>
        </div>
      ) : null}
      <ForgotPasswordForm disabled={demo} />
    </AuthShell>
  );
}
