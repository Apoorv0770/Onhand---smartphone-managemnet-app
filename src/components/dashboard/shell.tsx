"use client";

import {
  ChevronsUpDown,
  History,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  MoreHorizontal,
  PanelLeft,
  Plus,
  Settings,
  Smartphone,
  Store,
} from "lucide-react";
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { Suspense, useEffect, useState, useTransition } from "react";
import { Logo, LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Drawer, DrawerBody, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/sheet";
import { InlineScript } from "@/components/ui/inline-script";
import { cn, initials } from "@/lib/utils";
import { signOutAction } from "@/server/actions/auth";
import { SIDEBAR_BOOT_SCRIPT, SIDEBAR_KEY } from "./sidebar-state";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Layout segment below /dashboard that marks this item active. */
  segment: string | null;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, segment: null },
  { href: "/dashboard/inventory", label: "Inventory", icon: Smartphone, segment: "inventory" },
  { href: "/dashboard/storefront", label: "Storefront", icon: Store, segment: "storefront" },
  { href: "/dashboard/activity", label: "Activity", icon: History, segment: "activity" },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, segment: "settings" },
];

function toggleSidebar() {
  const root = document.documentElement;
  const collapsed = root.dataset.sidebar === "collapsed";
  if (collapsed) delete root.dataset.sidebar;
  else root.dataset.sidebar = "collapsed";
  try {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? "expanded" : "collapsed");
  } catch {
    // Preference just will not persist.
  }
}

/* ------------------------------- Navigation ------------------------------- */

function SidebarNav({ active }: { active: string | null | undefined }) {
  return (
    <nav aria-label="Dashboard" className="grid gap-0.5">
      {NAV.map((item) => {
        const isActive = active !== undefined && item.segment === active;
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "group/nav flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium outline-offset-0 transition-colors",
              "in-data-[sidebar=collapsed]:lg:justify-center in-data-[sidebar=collapsed]:lg:px-0",
              isActive
                ? "bg-surface text-foreground shadow-xs ring-1 ring-border"
                : "text-muted-foreground hover:bg-surface-3 hover:text-foreground",
            )}
          >
            <item.icon aria-hidden className={cn("size-4 shrink-0", isActive && "text-brand-strong")} />
            <span className="truncate in-data-[sidebar=collapsed]:lg:hidden">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function ActiveSidebarNav() {
  return <SidebarNav active={useSelectedLayoutSegment()} />;
}

function TabBar({ active, onMore }: { active: string | null | undefined; onMore: () => void }) {
  const tab = (item: NavItem) => {
    const isActive = active !== undefined && item.segment === active;
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-1 rounded-lg text-2xs font-medium outline-offset-[-2px] transition-colors",
          isActive ? "text-foreground" : "text-faint",
        )}
      >
        <item.icon aria-hidden className={cn("size-5", isActive && "text-brand-strong")} />
        {item.label}
      </Link>
    );
  };
  const moreActive = active === "activity" || active === "settings";

  return (
    <nav
      aria-label="Dashboard"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <div className="mx-auto flex h-16 max-w-lg items-stretch px-2">
        {tab(NAV[0])}
        {tab(NAV[1])}
        <div className="flex flex-1 items-center justify-center">
          <Link
            href="/dashboard/inventory/new"
            aria-label="Add a device"
            className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform active:scale-95"
          >
            <Plus className="size-5" />
          </Link>
        </div>
        {tab(NAV[2])}
        <button
          type="button"
          onClick={onMore}
          aria-haspopup="dialog"
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-1 rounded-lg text-2xs font-medium outline-offset-[-2px]",
            moreActive ? "text-foreground" : "text-faint",
          )}
        >
          <MoreHorizontal aria-hidden className={cn("size-5", moreActive && "text-brand-strong")} />
          More
        </button>
      </div>
    </nav>
  );
}

function ActiveTabBar({ onMore }: { onMore: () => void }) {
  return <TabBar active={useSelectedLayoutSegment()} onMore={onMore} />;
}

/* --------------------------------- Account -------------------------------- */

function useSignOut() {
  const [pending, startTransition] = useTransition();
  const signOut = () =>
    startTransition(async () => {
      await signOutAction();
      // Deliberately a full page load, not a client navigation: it drops every
      // piece of the previous user's client state, including pages the router
      // keeps mounted in the background.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login";
    });
  return { pending, signOut };
}

export function AccountMenu({ name, email }: { name: string; email: string }) {
  const { pending, signOut } = useSignOut();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-md p-1.5 text-left outline-offset-0 transition-colors hover:bg-surface-3 in-data-[sidebar=collapsed]:lg:justify-center"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
            {initials(name)}
          </span>
          <span className="min-w-0 flex-1 in-data-[sidebar=collapsed]:lg:hidden">
            <span className="block truncate text-[13px] font-medium leading-4">{name}</span>
            <span className="block truncate text-xs leading-4 text-muted-foreground">{email}</span>
          </span>
          <ChevronsUpDown aria-hidden className="size-3.5 shrink-0 text-faint in-data-[sidebar=collapsed]:lg:hidden" />
          <span className="sr-only">Account menu</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <div className="px-2.5 py-2">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings">
            <Settings />
            Account settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={pending}
          onSelect={(event) => {
            event.preventDefault();
            signOut();
          }}
        >
          <LogOut />
          {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SignOutButton({ className }: { className?: string }) {
  const { pending, signOut } = useSignOut();
  return (
    <Button variant="secondary" className={className} loading={pending} onClick={signOut}>
      {pending ? null : <LogOut />}
      Sign out
    </Button>
  );
}

/* ---------------------------------- Shell --------------------------------- */

interface ShellProps {
  /** Business avatar and name. Streams in once the session is known. */
  identity: React.ReactNode;
  /** Compact identity for the phone top bar. */
  mobileIdentity: React.ReactNode;
  /** "View storefront" shortcut. */
  storefrontLink: React.ReactNode;
  account: React.ReactNode;
  /** Mode badge shown in the top bar (demo mode notice). */
  badge?: React.ReactNode;
  children: React.ReactNode;
}

export function DashboardShell({ identity, mobileIdentity, storefrontLink, account, badge, children }: ShellProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  // Client navigations into the dashboard skip the inline boot script.
  useEffect(() => {
    try {
      if (localStorage.getItem(SIDEBAR_KEY) === "collapsed") document.documentElement.dataset.sidebar = "collapsed";
    } catch {
      // Ignore: storage unavailable.
    }
  }, []);

  return (
    <div className="flex min-h-dvh flex-1">
      <InlineScript html={SIDEBAR_BOOT_SCRIPT} />
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-surface-2 transition-[width] duration-200 ease-out in-data-[sidebar=collapsed]:w-[4.25rem] lg:flex">
        <div className="flex h-14 shrink-0 items-center px-4 in-data-[sidebar=collapsed]:justify-center in-data-[sidebar=collapsed]:px-0">
          <Link href="/dashboard" aria-label="Dashboard home" className="rounded-md">
            <Logo className="in-data-[sidebar=collapsed]:hidden" />
            <LogoMark className="hidden in-data-[sidebar=collapsed]:block" />
          </Link>
        </div>

        <div className="px-3 pb-3">{identity}</div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3">
          <Suspense fallback={<SidebarNav active={undefined} />}>
            <ActiveSidebarNav />
          </Suspense>
        </div>

        <div className="grid gap-1 border-t p-3">{account}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/88 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Toggle sidebar"
            onClick={toggleSidebar}
            className="-ml-1.5 hidden text-muted-foreground lg:inline-flex"
          >
            <PanelLeft />
          </Button>
          <div className="min-w-0 flex-1 lg:hidden">{mobileIdentity}</div>
          <div className="hidden min-w-0 flex-1 items-center gap-3 lg:flex">{badge}</div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="lg:hidden">{badge}</span>
            {storefrontLink}
            <Button asChild size="sm" className="hidden lg:inline-flex">
              <Link href="/dashboard/inventory/new">
                <Plus />
                Add device
              </Link>
            </Button>
          </div>
        </header>

        <main className="flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-16 lg:pt-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>

      <Suspense fallback={<TabBar active={undefined} onMore={() => setMoreOpen(true)} />}>
        <ActiveTabBar onMore={() => setMoreOpen(true)} />
      </Suspense>

      <Drawer open={moreOpen} onOpenChange={setMoreOpen}>
        <DrawerContent className="lg:hidden">
          <DrawerHeader>
            <div>
              <DrawerTitle>More</DrawerTitle>
              <DrawerDescription className="sr-only">Activity, settings and account</DrawerDescription>
            </div>
          </DrawerHeader>
          <DrawerBody className="grid gap-1 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {NAV.slice(3).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className="flex h-12 items-center gap-3 rounded-lg px-3 text-[15px] font-medium hover:bg-surface-3"
              >
                <item.icon aria-hidden className="size-5 text-muted-foreground" />
                {item.label}
              </Link>
            ))}
            <div className="mt-3 border-t pt-4">
              <SignOutButton className="h-11 w-full" />
            </div>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
