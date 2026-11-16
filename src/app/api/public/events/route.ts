import { z } from "zod";
import { getBackend } from "@/server/backend";

const eventSchema = z.object({
  slug: z.string().min(1).max(60),
  type: z.enum(["view", "inquiry"]),
  deviceId: z.string().max(24).nullish(),
});

/* A small in-memory limiter so one browser cannot inflate a shop's numbers. */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;
const hits = new Map<string, { count: number; resetAt: number }>();

function allow(key: string, now: number): boolean {
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    if (hits.size > 5000) {
      for (const [candidate, value] of hits) if (value.resetAt <= now) hits.delete(candidate);
    }
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_PER_WINDOW;
}

/** Records a storefront view or a WhatsApp inquiry tap. Always answers 204. */
export async function POST(request: Request) {
  const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const raw = await request.text().catch(() => "");
  if (!allow(client, Date.now())) return new Response(null, { status: 204 });

  let payload: unknown = null;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 204 });
  }

  const parsed = eventSchema.safeParse(payload);
  if (parsed.success) {
    try {
      const backend = await getBackend();
      await backend.recordEvent(parsed.data.slug.toLowerCase(), parsed.data.type, parsed.data.deviceId ?? null);
    } catch (error) {
      console.error("Could not record storefront event", error);
    }
  }
  return new Response(null, { status: 204 });
}
