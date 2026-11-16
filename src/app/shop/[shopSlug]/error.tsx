"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function StorefrontError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center">
      <ErrorState
        error={error}
        retry={retry}
        title="We could not load this catalog"
        description="This is usually a brief connection problem. Try again, or message the shop directly."
      />
    </main>
  );
}
