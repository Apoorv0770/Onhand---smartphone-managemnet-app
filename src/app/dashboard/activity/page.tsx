import { History } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { PageHeader } from "@/components/dashboard/page-header";
import { ListSkeleton } from "@/components/dashboard/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { formatWeekdayDate, istDay } from "@/lib/format";
import type { Activity } from "@/lib/types";
import { getBackend } from "@/server/backend";
import { requestNow } from "@/server/clock";
import { requireBusiness } from "@/server/session";

export const metadata: Metadata = { title: "Activity" };

export default function ActivityPage() {
  return (
    <>
      <PageHeader
        title="Activity"
        description="A record of every change to your inventory and storefront, newest first."
      />
      <Suspense fallback={<ListSkeleton />}>
        <ActivityLog />
      </Suspense>
    </>
  );
}

function groupByDay(entries: Activity[]): { day: string; entries: Activity[] }[] {
  const groups: { day: string; entries: Activity[] }[] = [];
  for (const entry of entries) {
    const day = istDay(entry.timestamp);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.entries.push(entry);
    else groups.push({ day, entries: [entry] });
  }
  return groups;
}

async function ActivityLog() {
  const { user, business } = await requireBusiness();
  const backend = await getBackend();
  const entries = await backend.listActivity(user.id, business.id, 150);
  const now = await requestNow();

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<History />}
        title="No activity yet"
        description="When you add, edit or sell a phone, it is recorded here."
      />
    );
  }

  const today = istDay(now);
  const yesterday = istDay(now - 24 * 60 * 60 * 1000);

  return (
    <div className="grid max-w-3xl gap-6">
      {groupByDay(entries).map((group) => (
        <section key={group.day}>
          <h2 className="eyebrow mb-3 text-faint">
            {group.day === today
              ? "Today"
              : group.day === yesterday
                ? "Yesterday"
                : formatWeekdayDate(group.entries[0].timestamp)}
          </h2>
          <div className="rounded-xl border bg-surface p-4 shadow-xs sm:p-5">
            <ActivityFeed entries={group.entries} now={now} detailed />
          </div>
        </section>
      ))}
      {entries.length === 150 ? (
        <p className="text-center text-xs text-faint">Showing the 150 most recent changes.</p>
      ) : null}
    </div>
  );
}
