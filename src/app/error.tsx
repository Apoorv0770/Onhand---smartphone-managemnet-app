"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center">
      <ErrorState
        error={error}
        retry={retry}
        title="We hit a problem loading this page"
        description="Check your connection and try again. If it keeps happening, come back in a few minutes."
        home={{ href: "/", label: "Go to the home page" }}
      />
    </main>
  );
}
