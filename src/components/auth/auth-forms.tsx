"use client";

import { ArrowRight, CircleAlert, Eye, EyeOff, MailCheck } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { ShopAvatar } from "@/components/shop/shop-avatar";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { AffixInput, Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  type AuthFormState,
  demoSignInAction,
  requestPasswordResetAction,
  signInAction,
  signUpAction,
  updatePasswordAction,
} from "@/server/actions/auth";

const INITIAL: AuthFormState = {};

function FormAlert({ state }: { state: AuthFormState }) {
  if (state.error) {
    return (
      <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-danger/25 bg-danger-soft px-3.5 py-3 text-sm leading-5 text-danger">
        <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
        {state.error}
      </div>
    );
  }
  if (state.notice) {
    return (
      <div role="status" className="flex items-start gap-2.5 rounded-lg border border-success/25 bg-success-soft px-3.5 py-3 text-sm leading-5 text-success">
        <MailCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
        {state.notice}
      </div>
    );
  }
  return null;
}

function PasswordInput({
  name = "password",
  autoComplete,
  ...props
}: Omit<React.ComponentProps<typeof AffixInput>, "type" | "trailing"> & { name?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <AffixInput
      {...props}
      name={name}
      type={visible ? "text" : "password"}
      autoComplete={autoComplete}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="flex size-8 items-center justify-center rounded-sm text-muted-foreground hover:bg-surface-3 hover:text-foreground"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      }
    />
  );
}

/* --------------------------------- Sign in -------------------------------- */

export function SignInForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signInAction, INITIAL);
  return (
    <form action={action} noValidate className="grid gap-4">
      <FormAlert state={state} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field label="Email" error={state.fieldErrors?.email}>
        {(control) => (
          <Input
            {...control}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="you@yourshop.in"
            defaultValue={state.values?.email}
            required
          />
        )}
      </Field>
      <Field
        label="Password"
        error={state.fieldErrors?.password}
        aside={
          <Link href="/forgot-password" className="text-xs font-medium text-brand-strong underline-offset-4 hover:underline">
            Forgot password?
          </Link>
        }
      >
        {(control) => <PasswordInput {...control} autoComplete="current-password" required />}
      </Field>
      <Button type="submit" size="lg" loading={pending} className="mt-1">
        Sign in
      </Button>
    </form>
  );
}

function DemoAccountButton({ business }: { business: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="group flex w-full items-center gap-3 rounded-lg border bg-surface p-2.5 text-left shadow-xs outline-offset-2 transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-sm disabled:opacity-60"
    >
      <ShopAvatar name={business} className="size-9 rounded-lg" textClassName="text-xs" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{business}</span>
        <span className="block text-xs text-muted-foreground">Open this shop&apos;s dashboard</span>
      </span>
      {pending ? (
        <Spinner className="mr-1 text-muted-foreground" />
      ) : (
        <ArrowRight aria-hidden className="mr-1 size-4 text-faint transition-transform group-hover:translate-x-0.5" />
      )}
    </button>
  );
}

/** One-click access to the seeded, fictional retailers. Demo mode only. */
export function DemoAccounts({ accounts }: { accounts: { business: string; email: string }[] }) {
  return (
    <div className="grid gap-2">
      {accounts.map((account) => (
        <form key={account.email} action={demoSignInAction}>
          <input type="hidden" name="email" value={account.email} />
          <DemoAccountButton business={account.business} />
        </form>
      ))}
    </div>
  );
}

/* --------------------------------- Sign up -------------------------------- */

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUpAction, INITIAL);

  if (state.notice) {
    return (
      <div className="grid gap-4">
        <FormAlert state={state} />
        <Button asChild variant="secondary" size="lg">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="grid gap-4">
      <FormAlert state={state} />
      <Field label="Your name" error={state.fieldErrors?.name}>
        {(control) => (
          <Input {...control} name="name" autoComplete="name" placeholder="Aarav Deshmukh" defaultValue={state.values?.name} required />
        )}
      </Field>
      <Field label="Email" error={state.fieldErrors?.email}>
        {(control) => (
          <Input
            {...control}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="you@yourshop.in"
            defaultValue={state.values?.email}
            required
          />
        )}
      </Field>
      <Field label="Password" error={state.fieldErrors?.password} hint="At least 8 characters.">
        {(control) => <PasswordInput {...control} autoComplete="new-password" minLength={8} required />}
      </Field>
      <Button type="submit" size="lg" loading={pending} className="mt-1">
        Create account
      </Button>
    </form>
  );
}

/* ----------------------------- Password recovery -------------------------- */

export function ForgotPasswordForm({ disabled }: { disabled?: boolean }) {
  const [state, action, pending] = useActionState(requestPasswordResetAction, INITIAL);
  return (
    <form action={action} noValidate className="grid gap-4">
      <FormAlert state={state} />
      <Field label="Email" error={state.fieldErrors?.email}>
        {(control) => (
          <Input
            {...control}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="you@yourshop.in"
            defaultValue={state.values?.email}
            disabled={disabled}
            required
          />
        )}
      </Field>
      <Button type="submit" size="lg" loading={pending} disabled={disabled} className="mt-1">
        Send reset link
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePasswordAction, INITIAL);
  return (
    <form action={action} noValidate className="grid gap-4">
      <FormAlert state={state} />
      <Field label="New password" error={state.fieldErrors?.password} hint="At least 8 characters.">
        {(control) => <PasswordInput {...control} autoComplete="new-password" minLength={8} required />}
      </Field>
      <Button type="submit" size="lg" loading={pending} className="mt-1">
        Save new password
      </Button>
    </form>
  );
}
