import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";

export function DeviceCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border bg-surface">
      <Skeleton className="aspect-[10/11] rounded-none" />
      <div className="grid gap-2 p-3 sm:p-4">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3.5 w-3/5" />
        <Skeleton className="mt-2 h-5 w-20" />
      </div>
    </div>
  );
}

/** Shell shown instantly while a shop's catalog streams in. */
export function StorefrontSkeleton() {
  return (
    <LoadingRegion label="Loading the catalog" className="flex min-h-dvh flex-col">
      <div className="container-page pt-3 sm:pt-5">
        <div className="rounded-[26px] bg-surface-3 px-5 pb-5 pt-20 sm:rounded-[32px] sm:px-8 sm:pb-8 sm:pt-28">
          <div className="flex items-end gap-4">
            <Skeleton className="size-16 rounded-2xl bg-surface sm:size-20" />
            <div className="grid gap-2.5 pb-1">
              <Skeleton className="h-7 w-52 bg-surface sm:h-9 sm:w-72" />
              <Skeleton className="h-4 w-40 bg-surface" />
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid gap-2">
            <Skeleton className="h-4 w-72 max-w-full" />
            <Skeleton className="h-4 w-52" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-11 flex-1 rounded-md sm:w-32 sm:flex-none" />
            <Skeleton className="h-11 w-24 rounded-md" />
          </div>
        </div>
      </div>
      <div className="container-page flex-1 pb-16 pt-8">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="mt-4 h-11 w-full rounded-full" />
        <div className="mt-6 lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:gap-10">
          <div className="hidden gap-6 lg:grid lg:content-start">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="grid gap-2.5">
                <Skeleton className="h-4 w-24" />
                <div className="flex flex-wrap gap-1.5">
                  <Skeleton className="h-8 w-20 rounded-full" />
                  <Skeleton className="h-8 w-24 rounded-full" />
                  <Skeleton className="h-8 w-16 rounded-full" />
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, index) => (
              <DeviceCardSkeleton key={index} />
            ))}
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}

export function DeviceDetailSkeleton() {
  return (
    <LoadingRegion label="Loading this phone" className="container-page min-h-dvh pb-28 pt-4">
      <Skeleton className="h-10 w-56 rounded-full" />
      <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14">
        <Skeleton className="aspect-[4/4.4] rounded-3xl sm:aspect-[4/3.6] lg:aspect-square" />
        <div className="grid content-start gap-4">
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-10 w-4/5" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-8 w-32" />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
          <Skeleton className="mt-2 h-12 rounded-lg" />
        </div>
      </div>
    </LoadingRegion>
  );
}
