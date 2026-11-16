"use client";

import { Plus } from "lucide-react";
import { Accordion as AccordionPrimitive, Tabs as TabsPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

/* -------------------------------- Accordion ------------------------------- */

export const Accordion = AccordionPrimitive.Root;

export function AccordionItem({ className, ...props }: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return <AccordionPrimitive.Item className={cn("border-b last:border-b-0", className)} {...props} />;
}

export function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        className={cn(
          "group flex flex-1 items-center justify-between gap-4 py-5 text-left text-base font-medium leading-6 tracking-[-0.01em] outline-none",
          "transition-colors hover:text-foreground focus-visible:text-brand-strong",
          className,
        )}
        {...props}
      >
        {children}
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-full border bg-surface text-muted-foreground transition-[transform,background-color,color] duration-300 group-hover:bg-surface-3 group-data-[state=open]:rotate-45 group-data-[state=open]:bg-foreground group-data-[state=open]:text-background"
        >
          <Plus className="size-3.5" />
        </span>
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

export function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      className="overflow-hidden text-[15px] leading-7 text-muted-foreground data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
      {...props}
    >
      <div className={cn("max-w-2xl pb-6 pr-10", className)}>{children}</div>
    </AccordionPrimitive.Content>
  );
}

/* ---------------------------------- Tabs ---------------------------------- */

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn("no-scrollbar flex items-center gap-1 overflow-x-auto border-b", className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "relative -mb-px inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3 text-sm font-medium text-muted-foreground outline-none",
        "transition-colors hover:text-foreground focus-visible:bg-surface-3",
        "data-[state=active]:border-foreground data-[state=active]:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("outline-none", className)} {...props} />;
}
