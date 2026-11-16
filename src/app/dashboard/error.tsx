"use client";

import { ErrorState } from "@/components/ui/error-state";

/** Keeps the dashboard shell on screen when one page fails to load. */
export default function DashboardError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <ErrorState
      error={error}
      retry={retry}
      title="This page could not be loaded"
      description="Your data is safe. Check your connection and try again."
      home={{ href: "/dashboard", label: "Back to overview" }}
      className="rounded-2xl border border-dashed bg-surface/60"
    />
  );
}
