"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/** Page numbers to show, with gaps collapsed: 1 … 4 5 6 … 12 */
function pageWindow(page: number, pageCount: number): (number | "gap")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const pages = new Set([1, pageCount, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((value) => pages.add(value));
  if (page >= pageCount - 2) [pageCount - 3, pageCount - 2, pageCount - 1].forEach((value) => pages.add(value));
  const sorted = [...pages].filter((value) => value >= 1 && value <= pageCount).sort((a, b) => a - b);
  const result: (number | "gap")[] = [];
  sorted.forEach((value, index) => {
    if (index > 0 && value - sorted[index - 1] > 1) result.push("gap");
    result.push(value);
  });
  return result;
}

export function Pagination({
  page,
  pageCount,
  onPageChange,
  summary,
  className,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** Text shown on the left, for example "1–25 of 64". */
  summary?: string;
  className?: string;
}) {
  if (pageCount <= 1 && !summary) return null;

  return (
    <nav aria-label="Pagination" className={cn("flex items-center justify-between gap-3", className)}>
      <p className="tnum text-[13px] text-muted-foreground">{summary}</p>
      {pageCount > 1 ? (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft />
          </Button>
          <ul className="hidden items-center gap-1 sm:flex">
            {pageWindow(page, pageCount).map((entry, index) =>
              entry === "gap" ? (
                <li key={`gap-${index}`} aria-hidden className="w-6 text-center text-sm text-faint">
                  …
                </li>
              ) : (
                <li key={entry}>
                  <button
                    type="button"
                    aria-label={`Page ${entry}`}
                    aria-current={entry === page ? "page" : undefined}
                    onClick={() => onPageChange(entry)}
                    className={cn(
                      "tnum flex h-8 min-w-8 items-center justify-center rounded-sm px-2 text-[13px] font-medium transition-colors",
                      entry === page
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:bg-surface-3 hover:text-foreground",
                    )}
                  >
                    {entry}
                  </button>
                </li>
              ),
            )}
          </ul>
          <span className="tnum px-2 text-[13px] text-muted-foreground sm:hidden">
            {page} / {pageCount}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next page"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      ) : null}
    </nav>
  );
}
