"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ImageUp, Trash2, TriangleAlert } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { ShopAvatar } from "@/components/shop/shop-avatar";
import { ShopCover } from "@/components/storefront/shop-header";
import { Button } from "@/components/ui/button";
import { Checkbox, SwitchRow } from "@/components/ui/controls";
import { Field, FormSection, Label } from "@/components/ui/field";
import { AffixInput, controlClasses, Input, Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { COVER_STYLES, WEEKDAYS } from "@/lib/catalog";
import { useDebounced } from "@/lib/hooks";
import { IMAGE_ACCEPT, uploadImage } from "@/lib/image";
import { storefrontFormSchema, type StorefrontFormValues } from "@/lib/schemas";
import type { BusinessHours, CoverStyleId, Weekday } from "@/lib/types";
import { cn, slugify } from "@/lib/utils";
import { checkSlugAction, updateStorefrontAction } from "@/server/actions/storefront";

/* ------------------------------ Image control ----------------------------- */

function SingleImage({
  label,
  value,
  onChange,
  maxDimension,
  shape,
  fallback,
  hint,
}: {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  maxDimension: number;
  shape: "square" | "wide";
  /** What to show while there is no image. */
  fallback: React.ReactNode;
  hint: string;
}) {
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await uploadImage(file, maxDimension));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={inputId}>
        {label}
        <span className="ml-1.5 font-normal text-faint">Optional</span>
      </Label>
      <div className={cn("flex gap-4", shape === "wide" ? "flex-col" : "items-center")}>
        <div
          className={cn(
            "relative shrink-0 overflow-hidden border bg-surface-2",
            shape === "square" ? "size-20 rounded-2xl" : "aspect-[5/1] w-full rounded-xl",
          )}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element -- pre-sized upload
            <img src={value} alt="" className="size-full object-cover" />
          ) : (
            fallback
          )}
          {busy ? (
            <div className="absolute inset-0 flex items-center justify-center bg-surface/70 backdrop-blur-[1px]">
              <Spinner label="Uploading" />
            </div>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary" size="sm" aria-disabled={busy}>
              <label htmlFor={inputId} className="cursor-pointer">
                <ImageUp />
                {value ? "Replace" : "Upload"}
              </label>
            </Button>
            {value ? (
              <Button variant="ghost" size="sm" onClick={() => onChange(null)} disabled={busy}>
                <Trash2 />
                Remove
              </Button>
            ) : null}
          </div>
          <input
            id={inputId}
            type="file"
            accept={IMAGE_ACCEPT}
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              void pick(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          {error ? (
            <p role="alert" className="text-[13px] leading-5 text-danger">
              {error}
            </p>
          ) : (
            <p className="text-[13px] leading-5 text-muted-foreground">{hint}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- Slug status ------------------------------ */

type SlugStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available" }
  | { state: "taken"; message: string };

function useSlugStatus(slug: string, original: string): SlugStatus {
  const debounced = useDebounced(slug, 350);
  const [result, setResult] = useState<{ slug: string; available: boolean; message?: string } | null>(null);

  useEffect(() => {
    if (!debounced || debounced === original) return;
    let cancelled = false;
    void checkSlugAction(debounced).then((answer) => {
      if (!cancelled) setResult({ slug: debounced, available: answer.available, message: answer.message });
    });
    return () => {
      cancelled = true;
    };
  }, [debounced, original]);

  if (!slug || slug === original) return { state: "idle" };
  if (slug !== debounced || result?.slug !== slug) return { state: "checking" };
  return result.available
    ? { state: "available" }
    : { state: "taken", message: result.message ?? "That address is already taken." };
}

export function SlugHint({ status }: { status: SlugStatus }) {
  if (status.state === "checking") {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Spinner className="size-3" label="Checking" />
        Checking availability
      </span>
    );
  }
  if (status.state === "available") {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-success">
        <Check aria-hidden className="size-3.5" />
        Available
      </span>
    );
  }
  if (status.state === "taken") {
    return <span className="font-medium text-danger">{status.message}</span>;
  }
  return null;
}

export { useSlugStatus };

/* ----------------------------------- Form --------------------------------- */

export function StorefrontForm({ defaults }: { defaults: StorefrontFormValues }) {
  const form = useForm<StorefrontFormValues>({
    resolver: zodResolver(storefrontFormSchema),
    defaultValues: defaults,
    reValidateMode: "onChange",
  });
  const { register, setValue, formState } = form;
  const errors = formState.errors;
  const values = useWatch({ control: form.control });
  const [saving, startSaving] = useTransition();
  const [savedSlug, setSavedSlug] = useState(defaults.slug);
  const root = useRef<HTMLFormElement>(null);

  const slug = values.slug ?? "";
  const slugStatus = useSlugStatus(slug, savedSlug);
  const hours = (values.hours ?? defaults.hours) as BusinessHours;
  const coverId = (values.coverStyle ?? defaults.coverStyle) as CoverStyleId;

  function set<Key extends keyof StorefrontFormValues>(key: Key, value: StorefrontFormValues[Key]) {
    setValue(key, value as never, { shouldDirty: true, shouldValidate: formState.isSubmitted });
  }

  function setDay(day: Weekday, patch: Partial<BusinessHours[Weekday]>) {
    set("hours", { ...hours, [day]: { ...hours[day], ...patch } });
  }

  function focusFirstError() {
    requestAnimationFrame(() => {
      const target = root.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"]');
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.focus({ preventScroll: true });
    });
  }

  function onValid(data: StorefrontFormValues) {
    startSaving(async () => {
      const result = await updateStorefrontAction(data);
      if (!result.ok) {
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
          form.setError(field as keyof StorefrontFormValues, { type: "server", message });
        }
        toast.error("Could not save your storefront", { description: result.error });
        focusFirstError();
        return;
      }
      setSavedSlug(result.data.slug);
      form.reset({ ...data, slug: result.data.slug });
      toast.success("Storefront updated", {
        description: "Customers see the changes straight away.",
        action: {
          label: "View",
          onClick: () => window.open(`/shop/${result.data.slug}?preview=1`, "_blank", "noopener"),
        },
      });
    });
  }

  function onInvalid() {
    toast.error("Please check the highlighted fields");
    focusFirstError();
  }

  return (
    <form ref={root} onSubmit={(event) => void form.handleSubmit(onValid, onInvalid)(event)} noValidate className="grid gap-5">
      <FormSection title="Shop identity" description="How your shop introduces itself at the top of the storefront.">
        <SingleImage
          label="Logo"
          value={values.logoUrl ?? null}
          onChange={(url) => set("logoUrl", url)}
          maxDimension={512}
          shape="square"
          hint="Square works best. Without a logo we show your initials."
          fallback={
            <ShopAvatar name={values.name || "Shop"} className="size-full rounded-none" textClassName="text-xl" />
          }
        />
        <Field label="Shop name" error={errors.name?.message} className="max-w-md">
          {(control) => <Input {...control} maxLength={60} autoComplete="organization" defaultValue={defaults.name} {...register("name")} />}
        </Field>
        <Field
          label="Short description"
          optional
          error={errors.description?.message}
          hint="One or two sentences about what you sell and why customers can trust it."
          aside={<span className="tnum text-xs text-faint">{(values.description ?? "").length}/240</span>}
        >
          {(control) => <Textarea {...control} rows={3} maxLength={240} defaultValue={defaults.description} {...register("description")} />}
        </Field>
      </FormSection>

      <FormSection title="Storefront address" description="The link you share. Keep it short and recognisable.">
        <Field
          label="Address"
          error={errors.slug?.message}
          hint={slugStatus.state === "idle" ? "Lowercase letters, numbers and hyphens." : <SlugHint status={slugStatus} />}
          className="max-w-md"
        >
          {(control) => (
            <AffixInput
              {...control}
              prefix="/shop/"
              className="font-mono"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={40}
              value={slug}
              onChange={(event) => set("slug", slugify(event.target.value.replace(/\s+/g, "-")) || event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            />
          )}
        </Field>
        {slug !== savedSlug ? (
          <p className="flex max-w-xl items-start gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-[13px] leading-5 text-warning">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            Changing your address breaks links and QR codes you have already shared. Customers using the old link will
            see a “storefront not found” page.
          </p>
        ) : null}
      </FormSection>

      <FormSection title="Contact and location" description="Where customers find you and how they reach you.">
        <Field
          label="Area and city"
          error={errors.location?.message}
          hint="Shown under your shop name, for example “Rajkamal Square, Amravati”."
          className="max-w-md"
        >
          {(control) => <Input {...control} maxLength={120} autoComplete="street-address" defaultValue={defaults.location} {...register("location")} />}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="WhatsApp number"
            error={errors.whatsappNumber?.message}
            hint="Inquiries from your storefront open a chat with this number."
          >
            {(control) => (
              <AffixInput
                {...control}
                prefix="+91"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="98765 43210"
                maxLength={14}
                defaultValue={defaults.whatsappNumber}
                {...register("whatsappNumber")}
              />
            )}
          </Field>
          <Field
            label="Phone number for calls"
            optional
            error={errors.phoneNumber?.message}
            hint="Adds a Call button. Leave empty to hide it."
          >
            {(control) => (
              <AffixInput
                {...control}
                prefix="+91"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="98765 43210"
                maxLength={14}
                defaultValue={defaults.phoneNumber}
                {...register("phoneNumber")}
              />
            )}
          </Field>
        </div>
        <Field label="Instagram" optional error={errors.instagramHandle?.message} className="max-w-md">
          {(control) => (
            <AffixInput
              {...control}
              prefix="@"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="yourshop"
              maxLength={60}
              defaultValue={defaults.instagramHandle}
              {...register("instagramHandle")}
            />
          )}
        </Field>
      </FormSection>

      <FormSection title="Appearance" description="Pick a cover for the top of your storefront, or upload your own banner.">
        <div className="grid gap-1.5">
          <Label id="cover-label">Cover style</Label>
          <div role="radiogroup" aria-labelledby="cover-label" className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {COVER_STYLES.map((style) => {
              const selected = coverId === style.id;
              return (
                <button
                  key={style.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => set("coverStyle", style.id)}
                  className={cn(
                    "group rounded-xl border p-1.5 text-left transition-[border-color,box-shadow]",
                    selected ? "border-foreground shadow-sm" : "hover:border-border-strong",
                  )}
                >
                  <span
                    className="relative block aspect-[4/3] overflow-hidden rounded-lg"
                    style={{ background: style.background }}
                  >
                    {selected ? (
                      <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-white text-foreground shadow-sm">
                        <Check aria-hidden className="size-3" strokeWidth={3} />
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1.5 block px-0.5 text-xs font-medium">{style.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <SingleImage
          label="Banner photo"
          value={values.bannerUrl ?? null}
          onChange={(url) => set("bannerUrl", url)}
          maxDimension={2000}
          shape="wide"
          hint="A wide photo of your shop or counter. It replaces the cover style when set."
          fallback={<span className="block size-full" style={{ background: COVER_STYLES.find((style) => style.id === coverId)?.background }} />}
        />

        <div className="grid gap-1.5">
          <p className="eyebrow text-faint">Preview</p>
          <ShopCover
            shop={{ bannerUrl: values.bannerUrl ?? null, coverStyle: coverId }}
            className="rounded-2xl px-5 pb-5 pt-12"
          >
            <div className="flex items-end gap-3.5">
              <ShopAvatar
                name={values.name || "Shop"}
                logoUrl={values.logoUrl}
                className="size-14 rounded-2xl shadow-lg ring-1 ring-white/25"
                textClassName="text-lg"
              />
              <div className="min-w-0 pb-0.5">
                <p className="truncate text-xl font-semibold tracking-[-0.03em]">{values.name || "Your shop name"}</p>
                <p className="mt-0.5 truncate text-[13px] opacity-85">{values.location || "Area, city"}</p>
              </div>
            </div>
          </ShopCover>
        </div>
      </FormSection>

      <FormSection title="Opening hours" description="Customers see whether you are open right now.">
        <SwitchRow
          id="hours-enabled"
          label="Show opening hours"
          description="Adds “Open now” or “Closed” next to your location, in India Standard Time."
          checked={Boolean(values.hoursEnabled)}
          onCheckedChange={(checked) => set("hoursEnabled", checked)}
        />
        {values.hoursEnabled ? (
          <div className="grid gap-2">
            <ul className="grid gap-2">
              {WEEKDAYS.map((day) => {
                const entry = hours[day.id];
                return (
                  <li
                    key={day.id}
                    className="grid grid-cols-[5.5rem_1fr] items-center gap-x-3 gap-y-2 rounded-lg border bg-surface px-3 py-2.5 sm:grid-cols-[7rem_auto_1fr]"
                  >
                    <span className="text-sm font-medium">{day.label}</span>
                    <label className="flex items-center gap-2 justify-self-end text-[13px] text-muted-foreground sm:justify-self-start">
                      <Checkbox
                        checked={entry.closed}
                        onCheckedChange={(checked) => setDay(day.id, { closed: checked === true })}
                      />
                      Closed
                    </label>
                    <div
                      className={cn(
                        "col-span-2 flex items-center gap-2 sm:col-span-1 sm:justify-self-end",
                        entry.closed && "pointer-events-none opacity-40",
                      )}
                    >
                      <input
                        type="time"
                        aria-label={`${day.label} opening time`}
                        disabled={entry.closed}
                        value={entry.open}
                        onChange={(event) => setDay(day.id, { open: event.target.value || entry.open })}
                        className={cn(controlClasses, "h-10 w-full px-2.5 sm:w-32")}
                      />
                      <span className="text-[13px] text-faint">to</span>
                      <input
                        type="time"
                        aria-label={`${day.label} closing time`}
                        disabled={entry.closed}
                        value={entry.close}
                        onChange={(event) => setDay(day.id, { close: event.target.value || entry.close })}
                        className={cn(controlClasses, "h-10 w-full px-2.5 sm:w-32")}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const monday = hours.mon;
                  const next = { ...hours };
                  for (const day of WEEKDAYS) next[day.id] = { ...monday };
                  set("hours", next);
                }}
              >
                Copy Monday to every day
              </Button>
            </div>
            {errors.hours ? (
              <p role="alert" className="text-[13px] leading-5 text-danger">
                Check the opening and closing times.
              </p>
            ) : null}
          </div>
        ) : null}
      </FormSection>

      <FormSection title="Catalog preferences">
        <SwitchRow
          id="prices-default"
          label="Show prices on new devices by default"
          description="Sets the starting position of the price switch when you add a phone. You can still change it for each device."
          checked={Boolean(values.showPricesByDefault)}
          onCheckedChange={(checked) => set("showPricesByDefault", checked)}
        />
        <SwitchRow
          id="show-sold"
          label="Keep sold phones visible"
          description="Sold phones stay in the catalog, marked as sold and listed last. Turn off to remove them from the storefront as soon as they sell."
          checked={Boolean(values.showSoldDevices)}
          onCheckedChange={(checked) => set("showSoldDevices", checked)}
        />
      </FormSection>

      {/* Floats above the page only while there is something to save. */}
      <div
        className={cn(
          "flex items-center justify-between gap-3 rounded-xl border bg-surface p-3",
          formState.isDirty
            ? "sticky bottom-20 z-20 bg-surface/95 shadow-md backdrop-blur-md lg:bottom-4"
            : "shadow-xs",
        )}
      >
        <p className="min-w-0 truncate pl-1 text-[13px] text-muted-foreground">
          {formState.isDirty ? "You have unsaved changes." : "Everything is saved."}
        </p>
        <div className="flex shrink-0 gap-2">
          {formState.isDirty ? (
            <Button variant="ghost" onClick={() => form.reset()} disabled={saving}>
              Discard
            </Button>
          ) : null}
          <Button
            type="submit"
            loading={saving}
            disabled={!formState.isDirty || slugStatus.state === "taken" || slugStatus.state === "checking"}
          >
            Save changes
          </Button>
        </div>
      </div>
    </form>
  );
}
