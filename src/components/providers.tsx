"use client";

import { MotionConfig } from "motion/react";
import { useSyncExternalStore } from "react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/popover";

const DESKTOP_QUERY = "(min-width: 768px)";

function subscribeToDesktop(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribeToDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
}

const toasterStyle = {
  "--normal-bg": "var(--foreground)",
  "--normal-text": "var(--background)",
  "--normal-border": "transparent",
  "--border-radius": "12px",
} as React.CSSProperties;

/**
 * App-wide client providers: motion preferences, tooltips and toasts.
 * Toasts sit at the top on phones so they never cover bottom action bars.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const isDesktop = useIsDesktop();
  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={250} skipDelayDuration={150}>
        {children}
        <Toaster
          position={isDesktop ? "bottom-right" : "top-center"}
          theme="light"
          style={toasterStyle}
          gap={10}
          offset={20}
          mobileOffset={12}
          toastOptions={{
            duration: 4500,
            classNames: {
              toast: "!shadow-lg !py-3.5 !px-4 !gap-3 !font-sans",
              title: "!text-sm !font-medium",
              description: "!text-[13px] !leading-5 !text-background/70",
              actionButton:
                "!h-8 !rounded-md !bg-background/15 !px-3 !text-[13px] !font-medium !text-background hover:!bg-background/25",
              cancelButton: "!h-8 !rounded-md !bg-transparent !px-2 !text-[13px] !text-background/70",
              icon: "!mr-0",
            },
          }}
        />
      </TooltipProvider>
    </MotionConfig>
  );
}
