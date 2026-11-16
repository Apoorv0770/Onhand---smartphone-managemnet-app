"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/** The page origin. Uses the configured site URL until the browser is known. */
export function useOrigin(fallback: string): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => fallback,
  );
}

/** True once running in the browser. Lets a component defer browser-only UI. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

const TICK_MS = 30_000;

function subscribeToClock(onTick: () => void) {
  const id = window.setInterval(onTick, TICK_MS);
  return () => window.clearInterval(id);
}

/**
 * The current time, refreshed twice a minute. Starts from the server's clock
 * so the first client render matches the server-rendered HTML exactly.
 */
export function useNow(serverNow: number): number {
  return useSyncExternalStore(
    subscribeToClock,
    () => Math.floor(Date.now() / TICK_MS) * TICK_MS,
    () => serverNow,
  );
}

/** Copy text to the clipboard and expose a short-lived "copied" flag. */
export function useCopy(resetAfterMs = 2000) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const area = document.createElement("textarea");
          area.value = text;
          area.setAttribute("readonly", "");
          area.style.position = "fixed";
          area.style.opacity = "0";
          document.body.appendChild(area);
          area.select();
          document.execCommand("copy");
          area.remove();
        }
        setCopied(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), resetAfterMs);
        return true;
      } catch {
        return false;
      }
    },
    [resetAfterMs],
  );

  return { copied, copy };
}

/** Returns a debounced copy of a fast-changing value. */
export function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

/**
 * When a page is shown inside a preview frame (onboarding, the landing page),
 * hide its scrollbar so the frame reads as a phone screen. Scrolling still works.
 */
export function useEmbeddedPreview(): void {
  useEffect(() => {
    if (window.self === window.top) return;
    const root = document.documentElement;
    root.classList.add("no-scrollbar");
    return () => root.classList.remove("no-scrollbar");
  }, []);
}
