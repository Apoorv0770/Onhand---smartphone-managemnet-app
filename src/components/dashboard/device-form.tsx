"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ExternalLink, Lock, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RadioGroup } from "radix-ui";
import { useRef, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { DeviceCardBody, deviceCardClasses } from "@/components/storefront/device-card";
import { Autocomplete } from "@/components/ui/autocomplete";
import { Button } from "@/components/ui/button";
import { Chip, Segmented, SwitchRow } from "@/components/ui/controls";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, FormSection, Label } from "@/components/ui/field";
import { AffixInput, Input, Textarea } from "@/components/ui/input";
import {
  ACCESSORY_OPTIONS,
  AVAILABILITY,
  BRANDS,
  colourSuggestionsFor,
  colourToHex,
  CONDITIONS,
  MODEL_SUGGESTIONS,
  reportsBatteryHealth,
  STORAGE_OPTIONS,
  WARRANTY_PRESETS,
} from "@/lib/catalog";
import { deviceLabel, deviceSlug } from "@/lib/device";
import { formatIndianNumber, formatStorage } from "@/lib/format";
import { deviceFormSchema, type DeviceFormValues } from "@/lib/schemas";
import type { ActionResult, AvailabilityStatus, PublicDevice } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createDeviceAction, deleteDeviceAction, updateDeviceAction } from "@/server/actions/devices";
import { ImageUploader } from "./image-uploader";

const ALL_MODELS = Object.values(MODEL_SUGGESTIONS).flat();

export type DeviceFormDefaults = Omit<DeviceFormValues, "condition"> & {
  condition?: DeviceFormValues["condition"];
};

interface DeviceFormProps {
  mode: "create" | "edit";
  defaults: DeviceFormDefaults;
  /** Today's date (IST) as YYYY-MM-DD, used as the latest allowed "date added". */
  today: string;
  shopSlug: string;
  /** Edit mode only. */
  deviceId?: string;
  shortId?: string;
}

function digitsToNumber(value: string, max: number): number | null {
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  return Math.min(max, Number(digits));
}

export function DeviceForm({ mode, defaults, today, shopSlug, deviceId, shortId }: DeviceFormProps) {
  const router = useRouter();
  const form = useForm<DeviceFormValues>({
    resolver: zodResolver(deviceFormSchema),
    defaultValues: defaults,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const { register, setValue, formState } = form;
  const errors = formState.errors;
  const values = useWatch({ control: form.control });

  const [saving, startSaving] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, startDeleting] = useTransition();
  const [customAccessory, setCustomAccessory] = useState("");
  const [customStorage, setCustomStorage] = useState(
    () => !STORAGE_OPTIONS.includes(defaults.storageGb as (typeof STORAGE_OPTIONS)[number]),
  );
  const [batteryOpen, setBatteryOpen] = useState(
    () => defaults.batteryHealth !== null || reportsBatteryHealth(defaults.brand),
  );
  const intent = useRef<"save" | "another">("save");
  const root = useRef<HTMLFormElement>(null);

  const brand = values.brand ?? "";
  const accessories = (values.accessories ?? []) as string[];
  const images = (values.images ?? []) as DeviceFormValues["images"];
  const status = (values.availabilityStatus ?? "available") as AvailabilityStatus;
  const showBattery = batteryOpen || reportsBatteryHealth(brand) || values.batteryHealth != null;

  function set<Key extends keyof DeviceFormValues>(key: Key, value: DeviceFormValues[Key]) {
    setValue(key, value as never, { shouldDirty: true, shouldValidate: formState.isSubmitted });
  }

  function focusFirstError() {
    requestAnimationFrame(() => {
      const target = root.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"]');
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.focus({ preventScroll: true });
    });
  }

  function onValid(data: DeviceFormValues) {
    if (uploading) {
      toast.message("Photos are still uploading", { description: "Give them a moment, then save again." });
      return;
    }
    startSaving(async () => {
      let nextReference = data.inventoryReference;
      let result: ActionResult<{ shortId: string }>;
      if (mode === "create") {
        const created = await createDeviceAction(data);
        if (created.ok) nextReference = created.data.nextReference;
        result = created;
      } else {
        result = await updateDeviceAction(deviceId ?? "", data);
      }

      if (!result.ok) {
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
          form.setError(field as keyof DeviceFormValues, { type: "server", message });
        }
        toast.error(mode === "create" ? "Could not add the device" : "Could not save changes", {
          description: result.error,
        });
        focusFirstError();
        return;
      }

      const label = deviceLabel(data);
      const viewUrl = `/shop/${shopSlug}/${deviceSlug({ ...data, id: result.data.shortId })}?preview=1`;
      const view = { label: "View", onClick: () => window.open(viewUrl, "_blank", "noopener") };

      if (mode === "create") {
        toast.success("Device added", { description: `${label} is now on your storefront.`, action: view });
        // Leave a clean form behind: this page stays mounted in the background.
        const fresh: DeviceFormDefaults = {
          ...defaults,
          inventoryReference: nextReference,
          brand: intent.current === "another" ? data.brand : defaults.brand,
        };
        form.reset(fresh);
        setCustomAccessory("");
        setCustomStorage(false);
        setBatteryOpen(reportsBatteryHealth(fresh.brand));
        if (intent.current === "another") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          router.push("/dashboard/inventory");
        }
      } else {
        toast.success("Changes saved", { description: `${label} is up to date on your storefront.`, action: view });
        form.reset(data);
        router.push("/dashboard/inventory");
      }
    });
  }

  function onInvalid() {
    toast.error("Please check the highlighted fields");
    focusFirstError();
  }

  function remove() {
    startDeleting(async () => {
      const result = await deleteDeviceAction(deviceId ?? "");
      setConfirmDelete(false);
      if (!result.ok) {
        toast.error("Could not delete the device", { description: result.error });
        return;
      }
      toast.success("Device deleted");
      router.push("/dashboard/inventory");
    });
  }

  const preview: PublicDevice = {
    id: "preview",
    reference: values.inventoryReference ?? "",
    brand: brand || "Brand",
    model: values.model || "Model name",
    storageGb: values.storageGb ?? 0,
    colour: values.colour ?? "",
    batteryHealth: values.batteryHealth ?? null,
    condition: values.condition ?? "good",
    cosmeticCondition: values.cosmeticCondition ?? "",
    functionalCondition: values.functionalCondition ?? "",
    accessories,
    warranty: values.warranty ?? "",
    availability: status,
    price: values.showPrice && values.price != null && status !== "sold" ? values.price : null,
    images: [...images].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)),
    addedAt: today,
  };

  const busy = saving || deleting;

  return (
    <form ref={root} onSubmit={(event) => void form.handleSubmit(onValid, onInvalid)(event)} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-8">
      <div className="grid min-w-0 gap-5">
        {/* ------------------------------ Device ------------------------------ */}
        <FormSection title="Device" description="What you are selling. Suggestions speed things up, but you can type anything.">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Brand" error={errors.brand?.message}>
              {(control) => (
                <Autocomplete
                  {...control}
                  value={brand}
                  options={[...BRANDS]}
                  maxVisible={12}
                  placeholder="Apple"
                  onValueChange={(value) => {
                    set("brand", value);
                    if (reportsBatteryHealth(value)) setBatteryOpen(true);
                  }}
                />
              )}
            </Field>
            <Field label="Model" error={errors.model?.message}>
              {(control) => (
                <Autocomplete
                  {...control}
                  value={values.model ?? ""}
                  options={MODEL_SUGGESTIONS[brand] ?? ALL_MODELS}
                  placeholder={MODEL_SUGGESTIONS[brand]?.[0] ?? "iPhone 14 Pro"}
                  onValueChange={(value) => set("model", value)}
                />
              )}
            </Field>
          </div>

          <div className="grid gap-1.5">
            <Label id="storage-label">Storage</Label>
            <div role="group" aria-labelledby="storage-label" className="flex flex-wrap gap-1.5">
              {STORAGE_OPTIONS.map((size) => (
                <Chip
                  key={size}
                  selected={!customStorage && values.storageGb === size}
                  onClick={() => {
                    setCustomStorage(false);
                    set("storageGb", size);
                  }}
                >
                  {formatStorage(size)}
                </Chip>
              ))}
              <Chip selected={customStorage} onClick={() => setCustomStorage(true)}>
                Other
              </Chip>
            </div>
            {customStorage ? (
              <AffixInput
                aria-label="Storage in GB"
                aria-invalid={errors.storageGb ? true : undefined}
                inputMode="numeric"
                suffix="GB"
                placeholder="32"
                wrapperClassName="mt-1 max-w-40"
                value={values.storageGb ? String(values.storageGb) : ""}
                onChange={(event) => set("storageGb", digitsToNumber(event.target.value, 4096) ?? 0)}
              />
            ) : null}
            {errors.storageGb ? (
              <p role="alert" className="text-[13px] leading-5 text-danger">
                {errors.storageGb.message}
              </p>
            ) : null}
          </div>

          <Field label="Colour" error={errors.colour?.message} className="sm:max-w-sm">
            {(control) => (
              <Autocomplete
                {...control}
                value={values.colour ?? ""}
                options={colourSuggestionsFor(brand)}
                placeholder={colourSuggestionsFor(brand)[0]}
                onValueChange={(value) => set("colour", value)}
                renderOption={(option) => (
                  <span
                    aria-hidden
                    className="size-3.5 shrink-0 rounded-full ring-1 ring-black/15"
                    style={{ backgroundColor: colourToHex(option, brand) }}
                  />
                )}
              />
            )}
          </Field>
        </FormSection>

        {/* ----------------------------- Condition ---------------------------- */}
        <FormSection title="Condition" description="Customers ask about this first. Be specific and they will trust the listing.">
          <div className="grid gap-1.5">
            <Label id="condition-label">Overall condition</Label>
            <RadioGroup.Root
              aria-labelledby="condition-label"
              aria-invalid={errors.condition ? true : undefined}
              data-invalid={errors.condition ? "true" : undefined}
              tabIndex={-1}
              value={values.condition ?? ""}
              onValueChange={(value) => set("condition", value as DeviceFormValues["condition"])}
              className="grid gap-2 outline-none sm:grid-cols-2"
            >
              {CONDITIONS.map((condition) => (
                <RadioGroup.Item
                  key={condition.id}
                  value={condition.id}
                  className={cn(
                    "group flex items-start gap-3 rounded-lg border bg-surface p-3 text-left outline-none transition-[border-color,box-shadow,background-color]",
                    "hover:border-border-strong focus-visible:ring-4 focus-visible:ring-ring/20",
                    "data-[state=checked]:border-foreground data-[state=checked]:bg-surface-2 data-[state=checked]:shadow-xs",
                    errors.condition && "border-danger/60",
                  )}
                >
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-border-strong transition-colors group-data-[state=checked]:border-foreground group-data-[state=checked]:bg-foreground">
                    <span className="size-1.5 rounded-full bg-background opacity-0 group-data-[state=checked]:opacity-100" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium leading-5">{condition.label}</span>
                    <span className="mt-0.5 block text-[13px] leading-5 text-muted-foreground">
                      {condition.description}
                    </span>
                  </span>
                </RadioGroup.Item>
              ))}
            </RadioGroup.Root>
            {errors.condition ? (
              <p role="alert" className="text-[13px] leading-5 text-danger">
                {errors.condition.message}
              </p>
            ) : null}
          </div>

          {showBattery ? (
            <Field
              label="Battery health"
              optional
              error={errors.batteryHealth?.message}
              hint={
                reportsBatteryHealth(brand)
                  ? "On an iPhone: Settings, Battery, Battery Health. Leave empty if you have not checked."
                  : "Only add this if the phone reports a battery health percentage."
              }
              className="max-w-xs"
              aside={
                !reportsBatteryHealth(brand) ? (
                  <button
                    type="button"
                    className="text-xs font-medium text-brand-strong underline-offset-4 hover:underline"
                    onClick={() => {
                      set("batteryHealth", null);
                      setBatteryOpen(false);
                    }}
                  >
                    Remove
                  </button>
                ) : undefined
              }
            >
              {(control) => (
                <AffixInput
                  {...control}
                  inputMode="numeric"
                  suffix="%"
                  placeholder="92"
                  value={values.batteryHealth != null ? String(values.batteryHealth) : ""}
                  onChange={(event) => set("batteryHealth", digitsToNumber(event.target.value, 100))}
                />
              )}
            </Field>
          ) : (
            <div>
              <Button variant="secondary" size="sm" onClick={() => setBatteryOpen(true)}>
                <Plus />
                Add battery health
              </Button>
              <p className="mt-1.5 text-[13px] leading-5 text-muted-foreground">
                Optional. Most Android phones do not report a percentage, so it is hidden unless you add it.
              </p>
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Cosmetic condition"
              optional
              error={errors.cosmeticCondition?.message}
              hint="Scratches, dents, screen marks."
            >
              {(control) => (
                <Textarea
                  {...control}
                  rows={3}
                  placeholder="Light scuffs on the frame corners. Screen is clean."
                  defaultValue={defaults.cosmeticCondition}
                  {...register("cosmeticCondition")}
                />
              )}
            </Field>
            <Field
              label="Functional condition"
              optional
              error={errors.functionalCondition?.message}
              hint="What you tested and anything that is not working."
            >
              {(control) => (
                <Textarea
                  {...control}
                  rows={3}
                  placeholder="Face ID, cameras, speakers and charging checked and working."
                  defaultValue={defaults.functionalCondition}
                  {...register("functionalCondition")}
                />
              )}
            </Field>
          </div>
        </FormSection>

        {/* ------------------------- Accessories, warranty -------------------- */}
        <FormSection title="Included with the phone">
          <div className="grid gap-1.5">
            <Label id="accessories-label">
              Accessories<span className="ml-1.5 font-normal text-faint">Optional</span>
            </Label>
            <div role="group" aria-labelledby="accessories-label" className="flex flex-wrap gap-1.5">
              {[...ACCESSORY_OPTIONS, ...accessories.filter((item) => !ACCESSORY_OPTIONS.includes(item))].map(
                (item) => {
                  const selected = accessories.includes(item);
                  return (
                    <Chip
                      key={item}
                      selected={selected}
                      onClick={() =>
                        set(
                          "accessories",
                          selected ? accessories.filter((entry) => entry !== item) : [...accessories, item],
                        )
                      }
                    >
                      {item}
                      {selected && !ACCESSORY_OPTIONS.includes(item) ? <X aria-hidden className="size-3.5" /> : null}
                    </Chip>
                  );
                },
              )}
            </div>
            <div className="mt-1 flex max-w-sm gap-2">
              <Input
                aria-label="Add another accessory"
                placeholder="Something else"
                maxLength={40}
                value={customAccessory}
                onChange={(event) => setCustomAccessory(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  const item = customAccessory.trim();
                  if (item && !accessories.includes(item)) set("accessories", [...accessories, item]);
                  setCustomAccessory("");
                }}
              />
              <Button
                variant="secondary"
                className="h-11 shrink-0 md:h-10"
                disabled={!customAccessory.trim()}
                onClick={() => {
                  const item = customAccessory.trim();
                  if (item && !accessories.includes(item)) set("accessories", [...accessories, item]);
                  setCustomAccessory("");
                }}
              >
                Add
              </Button>
            </div>
          </div>

          <Field label="Warranty" optional error={errors.warranty?.message} className="max-w-md">
            {(control) => (
              <>
                <Input {...control} placeholder="7-day shop warranty" maxLength={80} defaultValue={defaults.warranty} {...register("warranty")} />
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {WARRANTY_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => set("warranty", preset)}
                      className={cn(
                        "h-7 rounded-full border px-2.5 text-xs font-medium transition-colors",
                        values.warranty === preset
                          ? "border-foreground bg-foreground text-background"
                          : "bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground",
                      )}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </>
            )}
          </Field>
        </FormSection>

        {/* ------------------------------- Photos ----------------------------- */}
        <FormSection
          title="Photos"
          description="Real photos sell faster. Without them, customers see an illustration in the phone's colour."
        >
          <ImageUploader
            images={images}
            onChange={(next) => set("images", next)}
            onBusyChange={setUploading}
            error={errors.images?.message}
          />
        </FormSection>

        {/* ------------------------------- Pricing ---------------------------- */}
        <FormSection title="Pricing">
          <Field
            label="Asking price"
            optional
            error={errors.price?.message}
            hint="Used for your own records, and shown to customers only if you switch it on below."
            className="max-w-xs"
          >
            {(control) => (
              <AffixInput
                {...control}
                inputMode="numeric"
                prefix="₹"
                placeholder="36,500"
                className="tnum"
                value={values.price != null ? formatIndianNumber(values.price) : ""}
                onChange={(event) => set("price", digitsToNumber(event.target.value, 10_000_000))}
              />
            )}
          </Field>
          <SwitchRow
            id="show-price"
            label="Show price on storefront"
            description={
              values.price == null
                ? "No price entered, so customers will see “Price on request” either way."
                : values.showPrice
                  ? "Customers see this price on the catalog and the phone's page."
                  : "Customers see “Price on request” and can message you for it."
            }
            checked={Boolean(values.showPrice)}
            onCheckedChange={(checked) => set("showPrice", checked)}
          />
        </FormSection>

        {/* ------------------------------ Inventory --------------------------- */}
        <FormSection title="Inventory">
          <div className="grid gap-1.5">
            <Label id="status-label">Availability</Label>
            <Segmented
              label="Availability"
              value={status}
              onValueChange={(value) => set("availabilityStatus", value)}
              options={AVAILABILITY.map((option) => ({ value: option.id, label: option.label }))}
              className="w-full sm:w-auto"
              stretch
            />
            <p className="text-[13px] leading-5 text-muted-foreground">
              {AVAILABILITY.find((option) => option.id === status)?.description}
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Inventory reference"
              error={errors.inventoryReference?.message}
              hint="Unique to this phone. Customers quote it when they message you."
            >
              {(control) => (
                <Input
                  {...control}
                  className="font-mono"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={24}
                  defaultValue={defaults.inventoryReference}
                  {...register("inventoryReference")}
                />
              )}
            </Field>
            <Field label="Date added" error={errors.addedOn?.message}>
              {(control) => <Input {...control} type="date" max={today} defaultValue={defaults.addedOn} {...register("addedOn")} />}
            </Field>
          </div>

          <Field
            label={
              <span className="inline-flex items-center gap-1.5">
                Internal notes
                <span className="inline-flex h-5 items-center gap-1 rounded-full bg-surface-3 px-2 text-2xs font-medium text-muted-foreground">
                  <Lock aria-hidden className="size-3" />
                  Only you see this
                </span>
              </span>
            }
            optional
            error={errors.notes?.message}
            hint="Purchase details, lowest price you will accept, reminders. Never shown on your storefront."
          >
            {(control) => (
              <Textarea {...control} rows={3} placeholder="Bought from a walk-in customer with bill." defaultValue={defaults.notes} {...register("notes")} />
            )}
          </Field>
        </FormSection>

        {/* ------------------------------- Actions ---------------------------- */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {mode === "edit" ? (
              <Button variant="danger-ghost" onClick={() => setConfirmDelete(true)} disabled={busy}>
                <Trash2 />
                Delete device
              </Button>
            ) : null}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button asChild variant="ghost" className="h-11 sm:h-10">
              <Link href="/dashboard/inventory">Cancel</Link>
            </Button>
            {mode === "create" ? (
              <Button
                type="submit"
                variant="secondary"
                className="h-11 sm:h-10"
                disabled={busy}
                onClick={() => {
                  intent.current = "another";
                }}
              >
                Save and add another
              </Button>
            ) : null}
            <Button
              type="submit"
              className="h-11 sm:h-10"
              loading={saving}
              disabled={deleting}
              onClick={() => {
                intent.current = "save";
              }}
            >
              {mode === "create" ? "Add device" : "Save changes"}
            </Button>
          </div>
        </div>
      </div>

      {/* --------------------------------- Preview ---------------------------- */}
      <aside className="hidden lg:block">
        <div className="sticky top-20">
          <p className="eyebrow mb-2.5 text-faint">Storefront preview</p>
          <div className={cn(deviceCardClasses, "pointer-events-none")}>
            <DeviceCardBody device={preview} eager showCondition={Boolean(values.condition)} />
          </div>
          <p className="mt-3 text-[13px] leading-5 text-muted-foreground">
            This is how the phone appears in your catalog. Internal notes and hidden prices never leave this page.
          </p>
          {mode === "edit" && shortId ? (
            <Button asChild variant="secondary" size="sm" className="mt-3">
              <a
                href={`/shop/${shopSlug}/${deviceSlug({ ...preview, id: shortId })}?preview=1`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open public page
                <ExternalLink className="size-3.5 text-muted-foreground" />
              </a>
            </Button>
          ) : null}
        </div>
      </aside>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this device?"
        description="It will be removed from your inventory and your storefront, along with its photos. This cannot be undone. If it was sold, mark it as sold instead to keep the record."
        confirmLabel="Delete device"
        tone="danger"
        pending={deleting}
        onConfirm={remove}
      />
    </form>
  );
}
