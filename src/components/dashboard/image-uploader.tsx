"use client";

import { ImagePlus, RotateCw, Star, Trash2, TriangleAlert } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { IMAGE_ACCEPT, uploadImage } from "@/lib/image";
import type { DeviceImageInput } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PendingUpload {
  id: string;
  file: File;
  preview: string;
  error: string | null;
}

const MAX_IMAGES = 8;

/**
 * Photo picker for a device: add several at once (tap or drag and drop), see
 * previews immediately, remove any, and choose which one leads the listing.
 */
export function ImageUploader({
  images,
  onChange,
  onBusyChange,
  error,
}: {
  images: DeviceImageInput[];
  onChange: (images: DeviceImageInput[]) => void;
  /** Told when uploads start and finish, so the form can wait before saving. */
  onBusyChange?: (busy: boolean) => void;
  error?: string;
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Latest values for async upload callbacks.
  const latest = useRef({ images, onChange });
  useEffect(() => {
    latest.current = { images, onChange };
  });

  const uploading = pending.filter((item) => item.error === null).length;
  useEffect(() => {
    onBusyChange?.(uploading > 0);
  }, [uploading, onBusyChange]);

  // Release preview URLs when the component goes away.
  const previews = useRef(new Set<string>());
  useEffect(() => {
    const urls = previews.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  function discard(item: PendingUpload) {
    URL.revokeObjectURL(item.preview);
    previews.current.delete(item.preview);
    setPending((current) => current.filter((candidate) => candidate.id !== item.id));
  }

  async function start(item: PendingUpload) {
    setPending((current) =>
      current.map((candidate) => (candidate.id === item.id ? { ...candidate, error: null } : candidate)),
    );
    try {
      const url = await uploadImage(item.file);
      const current = latest.current.images;
      latest.current.onChange([...current, { url, isPrimary: current.length === 0 }]);
      // Keep the latest ref in step until the parent re-renders.
      latest.current.images = [...current, { url, isPrimary: current.length === 0 }];
      discard(item);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Upload failed. Try again.";
      setPending((current) =>
        current.map((candidate) => (candidate.id === item.id ? { ...candidate, error: message } : candidate)),
      );
    }
  }

  function addFiles(list: FileList | File[]) {
    const files = Array.from(list).filter((file) => file.type.startsWith("image/"));
    const skipped = Array.from(list).length - files.length;
    const room = MAX_IMAGES - images.length - pending.length;
    const accepted = files.slice(0, Math.max(0, room));

    if (files.length > accepted.length) {
      setNotice(`You can add up to ${MAX_IMAGES} photos per device.`);
    } else if (skipped > 0) {
      setNotice("Only image files can be added.");
    } else {
      setNotice(null);
    }

    const items = accepted.map((file) => {
      const preview = URL.createObjectURL(file);
      previews.current.add(preview);
      return { id: crypto.randomUUID(), file, preview, error: null };
    });
    if (items.length === 0) return;
    setPending((current) => [...current, ...items]);
    items.forEach((item) => void start(item));
  }

  function remove(url: string) {
    const next = images.filter((image) => image.url !== url);
    if (next.length > 0 && !next.some((image) => image.isPrimary)) next[0] = { ...next[0], isPrimary: true };
    onChange(next);
  }

  function makePrimary(url: string) {
    onChange(images.map((image) => ({ ...image, isPrimary: image.url === url })));
  }

  const full = images.length + pending.length >= MAX_IMAGES;

  return (
    <div>
      <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
        {images.map((image, index) => (
          <li key={image.url} className="group relative aspect-square overflow-hidden rounded-xl border bg-surface-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- already uploaded and pre-sized */}
            <img src={image.url} alt={`Photo ${index + 1}`} className="size-full object-cover" />
            <button
              type="button"
              onClick={() => makePrimary(image.url)}
              aria-pressed={image.isPrimary}
              aria-label={image.isPrimary ? `Photo ${index + 1} is the main photo` : `Make photo ${index + 1} the main photo`}
              className={cn(
                "absolute left-1.5 top-1.5 inline-flex h-6 items-center gap-1 rounded-full px-1.5 text-2xs font-semibold backdrop-blur-sm transition-colors",
                image.isPrimary
                  ? "bg-foreground text-background"
                  : "bg-white/85 text-foreground hover:bg-white",
              )}
            >
              <Star aria-hidden className={cn("size-3", image.isPrimary && "fill-current")} />
              {image.isPrimary ? "Main" : <span className="sr-only sm:not-sr-only">Set main</span>}
            </button>
            <button
              type="button"
              onClick={() => remove(image.url)}
              aria-label={`Remove photo ${index + 1}`}
              className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-white/85 text-foreground backdrop-blur-sm transition-colors hover:bg-danger hover:text-white"
            >
              <Trash2 className="size-3.5" />
            </button>
          </li>
        ))}

        {pending.map((item) => (
          <li key={item.id} className="relative aspect-square overflow-hidden rounded-xl border bg-surface-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- local preview of a file being uploaded */}
            <img src={item.preview} alt="" className={cn("size-full object-cover", item.error ? "opacity-30" : "opacity-50")} />
            {item.error ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-2 text-center">
                <TriangleAlert aria-hidden className="size-4 text-danger" />
                <p role="alert" className="line-clamp-3 text-2xs font-medium leading-3.5 text-danger">
                  {item.error}
                </p>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => void start(item)}
                    aria-label="Retry upload"
                    className="flex size-7 items-center justify-center rounded-full bg-surface shadow-xs ring-1 ring-border hover:bg-surface-3"
                  >
                    <RotateCw className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => discard(item)}
                    aria-label="Discard this photo"
                    className="flex size-7 items-center justify-center rounded-full bg-surface shadow-xs ring-1 ring-border hover:bg-surface-3"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="flex items-center gap-1.5 rounded-full bg-foreground/80 px-2.5 py-1 text-2xs font-medium text-white backdrop-blur-sm">
                  <Spinner className="size-3" label="Uploading" />
                  Uploading
                </span>
              </div>
            )}
          </li>
        ))}

        {!full ? (
          <li className={cn(images.length + pending.length === 0 && "col-span-3 sm:col-span-4")}>
            <label
              htmlFor={inputId}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                addFiles(event.dataTransfer.files);
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed text-center transition-colors",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                images.length + pending.length === 0 ? "min-h-36 px-6 py-8" : "aspect-square p-2",
                dragging
                  ? "border-brand bg-brand-soft text-brand-strong"
                  : "border-border-strong bg-surface-2/60 text-muted-foreground hover:border-foreground/40 hover:bg-surface-2 hover:text-foreground",
              )}
            >
              <ImagePlus aria-hidden className="size-5" />
              {images.length + pending.length === 0 ? (
                <>
                  <span className="text-sm font-medium text-foreground">Add photos</span>
                  <span className="max-w-xs text-xs leading-4">
                    Tap to take or choose photos, or drop them here. JPG, PNG or WebP, up to {MAX_IMAGES} photos.
                  </span>
                </>
              ) : (
                <span className="text-xs font-medium">Add more</span>
              )}
              <input
                ref={input}
                id={inputId}
                type="file"
                accept={IMAGE_ACCEPT}
                multiple
                className="sr-only"
                onChange={(event) => {
                  if (event.target.files) addFiles(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
          </li>
        ) : null}
      </ul>

      {error || notice ? (
        <p role={error ? "alert" : "status"} className={cn("mt-2 text-[13px] leading-5", error ? "text-danger" : "text-muted-foreground")}>
          {error ?? notice}
        </p>
      ) : images.length > 1 ? (
        <p className="mt-2 text-[13px] leading-5 text-muted-foreground">
          The main photo is shown first on your storefront.
        </p>
      ) : null}
    </div>
  );
}
