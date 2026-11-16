import { Database, HardDrive } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountForm } from "@/components/dashboard/account-form";
import { PageHeader, Panel } from "@/components/dashboard/page-header";
import { SignOutButton } from "@/components/dashboard/shell";
import { Badge } from "@/components/ui/badge";
import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";
import { isDemoMode } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { requireBusiness } from "@/server/session";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Your account and how this workspace stores its data." />
      <div className="grid max-w-3xl gap-5">
        <Suspense
          fallback={
            <LoadingRegion label="Loading your account" className="grid gap-5">
              <Skeleton className="h-56 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
            </LoadingRegion>
          }
        >
          <Account />
        </Suspense>
        <DataPanel />
      </div>
    </>
  );
}

async function Account() {
  const { user, business } = await requireBusiness();
  return (
    <>
      <Panel title="Profile">
        <AccountForm key={user.id} name={user.name} email={user.email} />
      </Panel>

      <Panel title="Workspace">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[13px] text-muted-foreground">Business</dt>
            <dd className="mt-0.5 flex items-center gap-2 font-medium">
              {business.name}
              {business.isDemo ? (
                <Badge tone="brand" size="sm">
                  Demo retailer
                </Badge>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-[13px] text-muted-foreground">Storefront address</dt>
            <dd className="mt-0.5 font-mono text-[13px]">/shop/{business.slug}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-muted-foreground">Your role</dt>
            <dd className="mt-0.5 font-medium">Owner</dd>
          </div>
          <div>
            <dt className="text-[13px] text-muted-foreground">Created</dt>
            <dd className="mt-0.5 font-medium">{formatDate(business.createdAt)}</dd>
          </div>
        </dl>
        {business.isDemo ? (
          <p className="mt-4 rounded-lg bg-surface-2 px-3.5 py-3 text-[13px] leading-5 text-muted-foreground">
            This is one of the seeded demo retailers. The shop and its inventory are fictional, and you are free to
            change anything. Run <code className="font-mono text-xs text-foreground">npm run demo:reset</code> to
            restore the original demo data.
          </p>
        ) : null}
      </Panel>

      <Panel title="Session" description="Signing out ends your session on this device.">
        <SignOutButton />
      </Panel>
    </>
  );
}

function DataPanel() {
  const demo = isDemoMode();
  return (
    <Panel title="Data storage">
      <div className="flex items-start gap-3.5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-surface-2 text-muted-foreground">
          {demo ? <HardDrive className="size-4.5" /> : <Database className="size-4.5" />}
        </span>
        <div className="min-w-0 text-sm leading-6">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            {demo ? "Demo mode: local data" : "Supabase"}
            <Badge tone={demo ? "brand" : "success"} size="sm">
              {demo ? "Not a hosted database" : "Connected"}
            </Badge>
          </p>
          <p className="mt-1 text-muted-foreground">
            {demo
              ? "Accounts, inventory and photos are saved in the .data folder of this project. They survive restarts and are protected by real sessions and server-side checks, but they live on this machine only. Add Supabase keys to .env.local to switch to Postgres, Supabase Auth and Storage."
              : "Accounts are handled by Supabase Auth, inventory lives in Postgres behind Row Level Security, and photos are stored in Supabase Storage."}
          </p>
        </div>
      </div>
    </Panel>
  );
}
