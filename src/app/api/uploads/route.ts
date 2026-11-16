import { getBackend, type UploadedImage } from "@/server/backend";
import { isAppError } from "@/server/errors";
import { getSessionContext } from "@/server/session";

// Matches the size limit of the Supabase storage bucket.
const MAX_BYTES = 6 * 1024 * 1024;

function json(body: Record<string, unknown>, status: number) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Identifies an image by its leading bytes instead of trusting the upload. */
function sniff(bytes: Uint8Array): UploadedImage["contentType"] | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  const ascii = (start: number) => String.fromCharCode(...bytes.slice(start, start + 4));
  if (ascii(0) === "RIFF" && ascii(8) === "WEBP") return "image/webp";
  return null;
}

/**
 * Receives one image for the signed-in retailer's business and stores it.
 * The business comes from the session, never from the request.
 */
export async function POST(request: Request) {
  const { user, business } = await getSessionContext();
  if (!user) return json({ error: "Your session has ended. Please sign in again." }, 401);
  if (!business) return json({ error: "Create your storefront before uploading photos." }, 403);

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) return json({ error: "No image was received." }, 400);
  if (file.size > MAX_BYTES) return json({ error: "That image is larger than 6 MB. Choose a smaller photo." }, 413);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = sniff(bytes);
  if (!contentType) return json({ error: "Use a JPG, PNG or WebP image." }, 415);

  try {
    const backend = await getBackend();
    const saved = await backend.saveImage(user.id, business.id, { bytes, contentType });
    return json({ url: saved.url }, 201);
  } catch (error) {
    if (isAppError(error)) return json({ error: error.message }, error.code === "forbidden" ? 403 : 400);
    console.error("Image upload failed", error);
    return json({ error: "The photo could not be saved. Please try again." }, 500);
  }
}
