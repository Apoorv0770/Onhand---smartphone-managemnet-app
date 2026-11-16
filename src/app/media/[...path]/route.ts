import { readFile } from "node:fs/promises";
import type { NextRequest } from "next/server";
import { isDemoMode } from "@/lib/env";

/**
 * Serves images uploaded in demo mode from ./.data/uploads.
 * With Supabase configured, images live in Supabase Storage and this route
 * answers 404. File names are random and never reused, so they cache forever.
 */
export async function GET(_request: NextRequest, context: RouteContext<"/media/[...path]">) {
  const { path } = await context.params;
  if (!isDemoMode()) return new Response("Not found", { status: 404 });

  const { resolveUpload } = await import("@/server/backend/local/store");
  const upload = resolveUpload(path);
  if (!upload) return new Response("Not found", { status: 404 });

  try {
    const bytes = await readFile(upload.file);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": upload.contentType,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
