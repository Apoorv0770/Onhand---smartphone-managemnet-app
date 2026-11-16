import "server-only";
import { isDemoMode } from "@/lib/env";
import type { Backend } from "./types";

export type { Backend, BackendMode, AuthResult, UploadedImage } from "./types";

/**
 * Returns the persistence layer for this deployment.
 * Supabase when its environment variables are set, otherwise the local demo
 * driver. Drivers are imported lazily so only the active one is loaded.
 */
export async function getBackend(): Promise<Backend> {
  if (isDemoMode()) {
    const { localBackend } = await import("./local");
    return localBackend;
  }
  const { createSupabaseBackend } = await import("./supabase");
  return createSupabaseBackend();
}
