/* Browser-side image preparation and upload. */

const MAX_DIMENSION = 1600;
const QUALITY = 0.82;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";
export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
}

/**
 * Downscales a photo to a sensible size before upload. A phone camera photo
 * is several megabytes; a catalog needs about a tenth of that. If the browser
 * cannot decode the file we send it untouched and let the server decide.
 */
export async function prepareImage(file: File, maxDimension = MAX_DIMENSION): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }

  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const alreadySmall = scale === 1 && file.size < 600 * 1024 && ACCEPTED.includes(file.type);
  if (alreadySmall) {
    bitmap.close();
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return file;
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const webp = await toBlob(canvas, "image/webp");
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await toBlob(canvas, "image/jpeg");
  return jpeg ?? file;
}

/** Uploads one prepared image for the signed-in business. Throws a readable Error. */
export async function uploadImage(file: File, maxDimension?: number): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("That file is not an image.");
  const blob = await prepareImage(file, maxDimension);
  if (blob.size > MAX_UPLOAD_BYTES) throw new Error("That image is larger than 6 MB. Choose a smaller photo.");

  const body = new FormData();
  body.append("file", blob, "photo");

  let response: Response;
  try {
    response = await fetch("/api/uploads", { method: "POST", body });
  } catch {
    throw new Error("Upload failed. Check your connection and try again.");
  }

  const data = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
  if (!response.ok || !data?.url) {
    // Some hosts refuse a large request before it reaches this app (Vercel
    // stops at 4.5 MB), and their answer carries no message of ours.
    const fallback =
      response.status === 413
        ? "That image is too large to upload. Choose a smaller photo."
        : "The photo could not be saved. Please try again.";
    throw new Error(data?.error ?? fallback);
  }
  return data.url;
}
