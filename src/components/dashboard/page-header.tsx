import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Consistent title block at the top of every dashboard page. */
export function PageHeader({
  title,
  description,
  back,
  children,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Optional link back to the parent page. */
  back?: { href: string; label: string };
  /** Contextual actions, right-aligned on wide screens. */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {back ? (
          <Link
            href={back.href}
            className="group -ml-1 mb-2 inline-flex items-center gap-1.5 rounded-sm px-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft aria-hidden className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
            {back.label}
          </Link>
        ) : null}
        <h1 className="text-2xl font-semibold leading-8 tracking-[-0.03em] sm:text-[28px] sm:leading-9">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {children ? <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

export function Panel({
  title,
  description,
  action,
  className,
  bodyClassName,
  children,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("min-w-0 rounded-xl border bg-surface shadow-xs", className)}>
      {title ? (
        <header className="flex items-center justify-between gap-4 border-b px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold leading-5">{title}</h2>
            {description ? <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">{description}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  );
}
