import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="rounded-xl border bg-surface p-4 shadow-xs">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-8 w-14" />
          <Skeleton className="mt-3 h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

function PanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="rounded-xl border bg-surface shadow-xs">
      <div className="border-b px-5 py-4">
        <Skeleton className="h-4 w-36" />
      </div>
      <div className="grid gap-4 p-5">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="size-10 shrink-0 rounded-lg" />
            <div className="grid flex-1 gap-2">
              <Skeleton className="h-3.5 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OverviewSkeleton() {
  return (
    <LoadingRegion label="Loading your overview" className="grid gap-5">
      <StatsSkeleton />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="grid gap-5 lg:col-span-2">
          <PanelSkeleton rows={3} />
          <PanelSkeleton rows={4} />
        </div>
        <div className="grid content-start gap-5">
          <PanelSkeleton rows={2} />
          <PanelSkeleton rows={4} />
        </div>
      </div>
    </LoadingRegion>
  );
}

export function InventorySkeleton() {
  return (
    <LoadingRegion label="Loading your inventory">
      <Skeleton className="h-10 w-80 max-w-full rounded-lg" />
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Skeleton className="h-11 flex-1 rounded-md md:h-10" />
        <Skeleton className="h-11 rounded-md sm:w-48 md:h-10" />
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border bg-surface shadow-xs">
        <Skeleton className="hidden h-10 rounded-none md:block" />
        <div className="divide-y">
          {Array.from({ length: 7 }, (_, index) => (
            <div key={index} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="size-12 shrink-0 rounded-lg" />
              <div className="grid flex-1 gap-2">
                <Skeleton className="h-3.5 w-44 max-w-[60%]" />
                <Skeleton className="h-3 w-32 max-w-[40%]" />
              </div>
              <Skeleton className="hidden h-6 w-20 rounded-full sm:block" />
              <Skeleton className="h-8 w-24 rounded-sm" />
            </div>
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}

export function FormSkeleton({ sections = 3 }: { sections?: number }) {
  return (
    <LoadingRegion label="Loading the form" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-8">
      <div className="grid gap-5">
        {Array.from({ length: sections }, (_, index) => (
          <div key={index} className="rounded-xl border bg-surface shadow-xs">
            <div className="border-b px-6 py-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-2 h-3 w-64 max-w-full" />
            </div>
            <div className="grid gap-5 px-6 py-5 sm:grid-cols-2">
              <div className="grid gap-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-10 rounded-md" />
              </div>
              <div className="grid gap-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-10 rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="hidden lg:block">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-3 aspect-[10/14] rounded-2xl" />
      </div>
    </LoadingRegion>
  );
}

export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <LoadingRegion label="Loading" className="rounded-xl border bg-surface shadow-xs">
      <div className="divide-y">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-3 px-5 py-4">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="grid flex-1 gap-2">
              <Skeleton className="h-3.5 w-3/5" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}
