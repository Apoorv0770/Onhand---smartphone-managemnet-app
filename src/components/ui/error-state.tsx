"use client";

import { RotateCw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Friendly fallback for unexpected failures. It never shows technical details
 * to the person using the app; those go to the console for whoever debugs it.
 */
export function ErrorState({
  error,
  retry,
  title = "Something went wrong",
  description = "This is on our side, not yours. Try again in a moment.",
  home,
  className,
}: {
  error: unknown;
  retry: () => void;
  title?: string;
  description?: string;
  /** Optional escape route when retrying does not help. */
  home?: { href: string; label: string };
  className?: string;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className={cn("flex flex-col items-center px-6 py-16 text-center", className)}>
      <div className="flex size-12 items-center justify-center rounded-xl border bg-surface text-danger shadow-sm">
        <TriangleAlert className="size-5" />
      </div>
      <h2 className="mt-5 text-xl font-semibold tracking-[-0.02em]">{title}</h2>
      <p className="mt-1.5 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button onClick={() => retry()}>
          <RotateCw />
          Try again
        </Button>
        {home ? (
          <Button asChild variant="secondary">
            <Link href={home.href}>{home.label}</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
