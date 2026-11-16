import { ArrowRight, CircleCheck, MessageCircle, PackagePlus, Plus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { PageHeader, Panel } from "@/components/dashboard/page-header";
import { ShareLink } from "@/components/dashboard/share-card";
import { OverviewSkeleton } from "@/components/dashboard/skeletons";
import { StatusBadge } from "@/components/device/badges";
import { DeviceVisual } from "@/components/device/device-visual";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { deviceSpecLine, deviceTitle } from "@/lib/device";
import { formatPrice, formatRelative, formatShortDate, plural } from "@/lib/format";
import type { Analytics, Business, Device } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getBackend } from "@/server/backend";
import { requestNow } from "@/server/clock";
import { requireBusiness } from "@/server/session";

export const metadata: Metadata = { title: "Overview" };

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default function OverviewPage() {
  return (
    <>
      <PageHeader title="Overview" description="Your stock and your storefront at a glance.">
        <Button asChild className="lg:hidden">
          <Link href="/dashboard/inventory/new">
            <Plus />
            Add device
          </Link>
        </Button>
      </PageHeader>
      <Suspense fallback={<OverviewSkeleton />}>
        <Overview />
      </Suspense>
    </>
  );
}

function Stat({
  label,
  value,
  note,
  href,
  dot,
}: {
  label: string;
  value: number;
  note: string;
  href: string;
  dot?: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border bg-surface p-4 shadow-xs outline-offset-2 transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-sm"
    >
      <p className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
        {dot ? <span aria-hidden className={cn("size-1.5 rounded-full", dot)} /> : null}
        {label}
      </p>
      <p className="tnum mt-2 text-[32px] font-semibold leading-9 tracking-[-0.04em]">{value}</p>
      <p className="mt-1.5 text-xs leading-4 text-faint">{note}</p>
    </Link>
  );
}

function VisitsChart({ analytics }: { analytics: Analytics }) {
  const peak = Math.max(1, ...analytics.days.map((day) => day.views));
  return (
    <div>
      <div className="flex h-28 items-end gap-1 sm:gap-1.5" aria-hidden>
        {analytics.days.map((day) => (
          <div key={day.day} className="flex h-full flex-1 flex-col justify-end" title={`${formatShortDate(`${day.day}T12:00:00+05:30`)}: ${plural(day.views, "visit")}, ${plural(day.inquiries, "inquiry", "inquiries")}`}>
            <div
              className={cn("w-full rounded-t-[4px]", day.views > 0 ? "bg-foreground/85" : "bg-surface-3")}
              style={{ height: day.views > 0 ? `${Math.max(8, (day.views / peak) * 100)}%` : "3px" }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-2xs text-faint" aria-hidden>
        <span>{formatShortDate(`${analytics.days[0].day}T12:00:00+05:30`)}</span>
        <span>Today</span>
      </div>
      <table className="sr-only">
        <caption>Storefront visits and WhatsApp inquiries per day</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Visits</th>
            <th scope="col">Inquiries</th>
          </tr>
        </thead>
        <tbody>
          {analytics.days.map((day) => (
            <tr key={day.day}>
              <th scope="row">{day.day}</th>
              <td>{day.views}</td>
              <td>{day.inquiries}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function setupSteps(business: Business, devices: Device[]) {
  return [
    { done: devices.length > 0, label: "Add your first phone", href: "/dashboard/inventory/new" },
    {
      done: devices.some((device) => device.images.length > 0),
      label: "Add photos to a phone",
      href: "/dashboard/inventory",
    },
    { done: Boolean(business.logoUrl), label: "Upload your shop logo", href: "/dashboard/storefront" },
    { done: business.settings.hours !== null, label: "Set your opening hours", href: "/dashboard/storefront" },
    { done: Boolean(business.description), label: "Write a short description", href: "/dashboard/storefront" },
  ];
}

async function Overview() {
  const { user, business } = await requireBusiness();
  const backend = await getBackend();
  const [devices, activity, analytics] = await Promise.all([
    backend.listDevices(user.id, business.id),
    backend.listActivity(user.id, business.id, 7),
    backend.getAnalytics(user.id, business.id, 14),
  ]);
  const now = await requestNow();

  const available = devices.filter((device) => device.availabilityStatus === "available");
  const reserved = devices.filter((device) => device.availabilityStatus === "reserved");
  const sold = devices.filter((device) => device.availabilityStatus === "sold");
  const addedThisWeek = devices.filter((device) => now - new Date(device.createdAt).getTime() < WEEK_MS).length;
  const soldThisWeek = sold.filter((device) => device.soldAt && now - new Date(device.soldAt).getTime() < WEEK_MS).length;
  const hiddenPrices = available.filter((device) => !device.showPrice || device.price === null).length;
  const recent = devices.slice(0, 5);
  const steps = setupSteps(business, devices);
  const remaining = steps.filter((step) => !step.done);
  const topInquired = Object.entries(analytics.inquiriesByDevice)
    .map(([shortId, count]) => ({ device: devices.find((candidate) => candidate.shortId === shortId), count }))
    .filter((entry): entry is { device: Device; count: number } => Boolean(entry.device))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Total devices"
          value={devices.length}
          note={addedThisWeek > 0 ? `${addedThisWeek} added in the last 7 days` : "None added in the last 7 days"}
          href="/dashboard/inventory"
        />
        <Stat
          label="Available"
          value={available.length}
          note={
            hiddenPrices > 0
              ? `${plural(hiddenPrices, "phone")} without a public price`
              : "All show a public price"
          }
          href="/dashboard/inventory"
          dot="bg-success-dot"
        />
        <Stat
          label="Reserved"
          value={reserved.length}
          note={reserved.length > 0 ? "On hold for customers" : "Nothing on hold"}
          href="/dashboard/inventory"
          dot="bg-warning-dot"
        />
        <Stat
          label="Sold"
          value={sold.length}
          note={soldThisWeek > 0 ? `${soldThisWeek} in the last 7 days` : "None in the last 7 days"}
          href="/dashboard/inventory"
          dot="bg-faint"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="grid min-w-0 grid-cols-1 content-start gap-5 lg:col-span-2">
          <Panel
            title="Storefront activity"
            description="Last 14 days. Counted from real visits, not including your own previews."
          >
            <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:gap-8">
              <dl className="flex gap-8 sm:flex-col sm:gap-5">
                <div>
                  <dt className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
                    <Users aria-hidden className="size-3.5" />
                    Visits
                  </dt>
                  <dd className="tnum mt-1 text-[28px] font-semibold leading-8 tracking-[-0.03em]">
                    {analytics.totalViews}
                  </dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
                    <MessageCircle aria-hidden className="size-3.5" />
                    WhatsApp inquiries
                  </dt>
                  <dd className="tnum mt-1 text-[28px] font-semibold leading-8 tracking-[-0.03em]">
                    {analytics.totalInquiries}
                  </dd>
                </div>
              </dl>
              <div className="min-w-0">
                <VisitsChart analytics={analytics} />
                {analytics.totalViews === 0 ? (
                  <p className="mt-3 text-[13px] leading-5 text-muted-foreground">
                    No visits yet. Share your storefront link and they will show up here.
                  </p>
                ) : topInquired.length > 0 ? (
                  <div className="mt-4 border-t pt-3">
                    <p className="eyebrow text-faint">Most asked about</p>
                    <ul className="mt-2 grid gap-1.5">
                      {topInquired.map(({ device, count }) => (
                        <li key={device.id} className="flex items-center justify-between gap-3 text-[13px]">
                          <Link
                            href={`/dashboard/inventory/${device.id}`}
                            className="min-w-0 truncate font-medium underline-offset-4 hover:underline"
                          >
                            {deviceTitle(device)} · {deviceSpecLine(device)}
                          </Link>
                          <span className="tnum shrink-0 text-muted-foreground">
                            {plural(count, "inquiry", "inquiries")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          </Panel>

          <Panel
            title="Recently added"
            action={
              <Button asChild variant="ghost" size="sm" className="-mr-2">
                <Link href="/dashboard/inventory">
                  View inventory
                  <ArrowRight />
                </Link>
              </Button>
            }
            bodyClassName={recent.length > 0 ? "p-0 sm:p-0" : undefined}
          >
            {recent.length === 0 ? (
              <EmptyState
                compact
                className="border-0 bg-transparent"
                icon={<PackagePlus />}
                title="No devices yet"
                description="Add your first phone to bring your storefront to life."
              >
                <Button asChild>
                  <Link href="/dashboard/inventory/new">
                    <Plus />
                    Add your first device
                  </Link>
                </Button>
              </EmptyState>
            ) : (
              <ul className="divide-y">
                {recent.map((device) => (
                  <li key={device.id}>
                    <Link
                      href={`/dashboard/inventory/${device.id}`}
                      className="flex items-center gap-3 px-4 py-3 outline-offset-[-2px] transition-colors hover:bg-surface-2 sm:px-5"
                    >
                      <DeviceVisual
                        brand={device.brand}
                        model={device.model}
                        colour={device.colour}
                        imageUrl={device.images.find((image) => image.isPrimary)?.url ?? device.images[0]?.url}
                        alt=""
                        inset="p-[10%]"
                        className="size-11 shrink-0 rounded-lg border"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{deviceTitle(device)}</span>
                        <span className="block truncate text-[13px] text-muted-foreground">
                          {deviceSpecLine(device)}
                          {device.price !== null ? ` · ${formatPrice(device.price)}` : ""}
                        </span>
                      </span>
                      <span className="hidden shrink-0 text-xs text-faint sm:block">
                        {formatRelative(device.createdAt, now)}
                      </span>
                      <StatusBadge status={device.availabilityStatus} size="sm" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="grid min-w-0 grid-cols-1 content-start gap-5">
          <Panel title="Your storefront link" description="Share it on Instagram, WhatsApp or a printed QR code.">
            <ShareLink slug={business.slug} shopName={business.name} />
          </Panel>

          {remaining.length > 0 ? (
            <Panel
              title="Finish setting up"
              description={`${steps.length - remaining.length} of ${steps.length} done`}
              bodyClassName="p-2 sm:p-2"
            >
              <ul>
                {steps.map((step) => (
                  <li key={step.label}>
                    <Link
                      href={step.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-offset-[-2px] transition-colors hover:bg-surface-2",
                        step.done && "text-muted-foreground",
                      )}
                    >
                      {step.done ? (
                        <CircleCheck aria-hidden className="size-4 shrink-0 text-success" />
                      ) : (
                        <span aria-hidden className="size-4 shrink-0 rounded-full border-[1.5px] border-border-strong" />
                      )}
                      <span className={cn("flex-1", step.done && "line-through decoration-border-strong")}>
                        {step.label}
                      </span>
                      {step.done ? <span className="sr-only">Done</span> : <ArrowRight aria-hidden className="size-3.5 text-faint" />}
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <Panel
            title="Recent activity"
            action={
              <Button asChild variant="ghost" size="sm" className="-mr-2">
                <Link href="/dashboard/activity">
                  View all
                  <ArrowRight />
                </Link>
              </Button>
            }
          >
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">Changes to your inventory will appear here.</p>
            ) : (
              <ActivityFeed entries={activity} now={now} />
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
