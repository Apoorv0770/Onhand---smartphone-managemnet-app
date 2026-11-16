"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, ExternalLink, PartyPopper, Printer, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { InstagramIcon } from "@/components/brand/icons";
import { ShareLink } from "@/components/dashboard/share-card";
import { SlugHint, useSlugStatus } from "@/components/dashboard/storefront-form";
import { Autocomplete } from "@/components/ui/autocomplete";
import { Button } from "@/components/ui/button";
import { Chip, SwitchRow } from "@/components/ui/controls";
import { Field, Label } from "@/components/ui/field";
import { AffixInput, Input, Textarea } from "@/components/ui/input";
import {
  BRANDS,
  colourSuggestionsFor,
  colourToHex,
  CONDITIONS,
  MODEL_SUGGESTIONS,
  reportsBatteryHealth,
  STORAGE_OPTIONS,
} from "@/lib/catalog";
import { nextReference, referencePrefix } from "@/lib/device";
import { formatIndianNumber, formatStorage, istDay } from "@/lib/format";
import { useOrigin } from "@/lib/hooks";
import { businessFormSchema, type BusinessFormValues, deviceFormSchema, type DeviceFormValues, fieldErrorsOf } from "@/lib/schemas";
import { siteUrl } from "@/lib/site";
import type { DeviceCondition } from "@/lib/types";
import { cn, slugify } from "@/lib/utils";
import { createDeviceAction } from "@/server/actions/devices";
import { completeOnboardingAction, createBusinessAction } from "@/server/actions/storefront";

type Step = "details" | "address" | "device" | "preview" | "share";

const STEPS: { id: Step; label: string }[] = [
  { id: "details", label: "Your shop" },
  { id: "address", label: "Your link" },
  { id: "device", label: "First phone" },
  { id: "preview", label: "Preview" },
  { id: "share", label: "Share" },
];

function Stepper({ current }: { current: Step }) {
  const index = STEPS.findIndex((step) => step.id === current);
  return (
    <nav aria-label="Setup progress">
      <ol className="flex items-center gap-1.5">
        {STEPS.map((step, position) => {
          const done = position < index;
          const active = position === index;
          return (
            <li key={step.id} className="flex-1" aria-current={active ? "step" : undefined}>
              <span
                className={cn(
                  "block h-1 rounded-full transition-colors duration-300",
                  done ? "bg-foreground" : active ? "bg-brand" : "bg-surface-3",
                )}
              />
              <span
                className={cn(
                  "mt-2 hidden text-xs font-medium sm:block",
                  active ? "text-foreground" : done ? "text-muted-foreground" : "text-faint",
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-xs font-medium text-muted-foreground sm:hidden">
        Step {index + 1} of {STEPS.length} · {STEPS[index].label}
      </p>
    </nav>
  );
}

function StepHeading({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="text-[26px] font-semibold leading-8 tracking-[-0.03em] sm:text-[30px] sm:leading-9">{title}</h1>
      <p className="mt-2 text-[15px] leading-6 text-muted-foreground">{children}</p>
    </div>
  );
}

function digits(value: string, max: number): number | null {
  const clean = value.replace(/\D/g, "");
  return clean ? Math.min(max, Number(clean)) : null;
}

/* ------------------------------ First device ------------------------------ */

function FirstDevice({
  shopName,
  showPricesByDefault,
  onDone,
  onSkip,
}: {
  shopName: string;
  showPricesByDefault: boolean;
  onDone: () => void;
  onSkip: () => void;
}) {
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [storageGb, setStorageGb] = useState(128);
  const [colour, setColour] = useState("");
  const [condition, setCondition] = useState<DeviceCondition | null>(null);
  const [battery, setBattery] = useState<number | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [showPrice, setShowPrice] = useState(showPricesByDefault);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const values = {
      brand,
      model,
      storageGb,
      colour,
      condition: condition ?? undefined,
      batteryHealth: battery,
      cosmeticCondition: "",
      functionalCondition: "",
      accessories: [],
      warranty: "",
      notes: "",
      price,
      showPrice,
      availabilityStatus: "available",
      inventoryReference: nextReference(referencePrefix(shopName), []),
      addedOn: istDay(Date.now()),
      images: [],
    };
    const parsed = deviceFormSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrorsOf(parsed.error));
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await createDeviceAction(parsed.data satisfies DeviceFormValues);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error("Could not add the phone", { description: result.error });
        return;
      }
      toast.success("Your first phone is listed");
      onDone();
    });
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Brand" error={errors.brand}>
          {(control) => (
            <Autocomplete
              {...control}
              value={brand}
              options={[...BRANDS]}
              maxVisible={12}
              placeholder="Apple"
              onValueChange={setBrand}
            />
          )}
        </Field>
        <Field label="Model" error={errors.model}>
          {(control) => (
            <Autocomplete
              {...control}
              value={model}
              options={MODEL_SUGGESTIONS[brand] ?? Object.values(MODEL_SUGGESTIONS).flat()}
              placeholder={MODEL_SUGGESTIONS[brand]?.[0] ?? "iPhone 14 Pro"}
              onValueChange={setModel}
            />
          )}
        </Field>
      </div>

      <div className="grid gap-1.5">
        <Label id="first-storage">Storage</Label>
        <div role="group" aria-labelledby="first-storage" className="flex flex-wrap gap-1.5">
          {STORAGE_OPTIONS.map((size) => (
            <Chip key={size} selected={storageGb === size} onClick={() => setStorageGb(size)}>
              {formatStorage(size)}
            </Chip>
          ))}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Colour" error={errors.colour}>
          {(control) => (
            <Autocomplete
              {...control}
              value={colour}
              options={colourSuggestionsFor(brand)}
              placeholder={colourSuggestionsFor(brand)[0]}
              onValueChange={setColour}
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
        {reportsBatteryHealth(brand) ? (
          <Field label="Battery health" optional error={errors.batteryHealth}>
            {(control) => (
              <AffixInput
                {...control}
                inputMode="numeric"
                suffix="%"
                placeholder="92"
                value={battery !== null ? String(battery) : ""}
                onChange={(event) => setBattery(digits(event.target.value, 100))}
              />
            )}
          </Field>
        ) : null}
      </div>

      <div className="grid gap-1.5">
        <Label id="first-condition">Condition</Label>
        <div role="group" aria-labelledby="first-condition" className="flex flex-wrap gap-1.5" data-invalid={errors.condition ? "true" : undefined}>
          {CONDITIONS.map((option) => (
            <Chip key={option.id} selected={condition === option.id} onClick={() => setCondition(option.id)}>
              {option.label}
            </Chip>
          ))}
        </div>
        {errors.condition ? (
          <p role="alert" className="text-[13px] leading-5 text-danger">
            {errors.condition}
          </p>
        ) : (
          <p className="text-[13px] leading-5 text-muted-foreground">
            {condition ? CONDITIONS.find((option) => option.id === condition)?.description : "How the phone looks overall."}
          </p>
        )}
      </div>

      <div className="grid gap-4 rounded-xl border bg-surface-2/60 p-4">
        <Field label="Asking price" optional error={errors.price} className="max-w-xs">
          {(control) => (
            <AffixInput
              {...control}
              inputMode="numeric"
              prefix="₹"
              placeholder="36,500"
              wrapperClassName="bg-surface"
              value={price !== null ? formatIndianNumber(price) : ""}
              onChange={(event) => setPrice(digits(event.target.value, 10_000_000))}
            />
          )}
        </Field>
        <SwitchRow
          id="first-show-price"
          label="Show price on storefront"
          description="When off, customers see “Price on request” and message you for it."
          checked={showPrice}
          onCheckedChange={setShowPrice}
        />
      </div>

      <p className="text-[13px] leading-5 text-muted-foreground">
        You can add photos, accessories, warranty and notes later from your inventory.
      </p>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button variant="ghost" size="lg" onClick={onSkip} disabled={pending}>
          Skip for now
        </Button>
        <Button type="submit" size="lg" loading={pending}>
          Add this phone
          {pending ? null : <ArrowRight />}
        </Button>
      </div>
    </form>
  );
}

/* ---------------------------------- Flow ---------------------------------- */

export function OnboardingFlow({
  userName,
  business,
  hasDevice,
}: {
  userName: string;
  business: { name: string; slug: string; showPricesByDefault: boolean } | null;
  hasDevice: boolean;
}) {
  const router = useRouter();
  const origin = useOrigin(siteUrl());
  const [step, setStep] = useState<Step>(business ? (hasDevice ? "preview" : "device") : "details");
  const [shop, setShop] = useState(business);
  const [slugTouched, setSlugTouched] = useState(false);
  const [pending, startTransition] = useTransition();
  const [finishing, startFinishing] = useTransition();

  const form = useForm<BusinessFormValues>({
    resolver: zodResolver(businessFormSchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      location: "",
      whatsappNumber: "",
      phoneNumber: "",
      instagramHandle: "",
    },
    reValidateMode: "onChange",
  });
  const { register, formState } = form;
  const errors = formState.errors;
  const values = useWatch({ control: form.control });
  const slug = values.slug ?? "";
  const slugStatus = useSlugStatus(step === "address" ? slug : "", "");
  const firstName = userName.trim().split(/\s+/)[0] || "there";

  async function toAddress() {
    const valid = await form.trigger(["name", "location", "whatsappNumber", "description"]);
    if (!valid) return;
    if (!slugTouched) form.setValue("slug", slugify(form.getValues("name")).slice(0, 40));
    setStep("address");
  }

  const createShop = form.handleSubmit((data) => {
    startTransition(async () => {
      const result = await createBusinessAction(data);
      if (!result.ok) {
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
          form.setError(field as keyof BusinessFormValues, { type: "server", message });
        }
        const detailFields = ["name", "location", "whatsappNumber", "description"];
        if (Object.keys(result.fieldErrors ?? {}).some((field) => detailFields.includes(field))) setStep("details");
        toast.error("Could not create your storefront", { description: result.error });
        return;
      }
      setShop({ name: data.name, slug: result.data.slug, showPricesByDefault: true });
      setStep("device");
    });
  });

  function finish() {
    startFinishing(async () => {
      const result = await completeOnboardingAction();
      if (!result.ok) {
        toast.error("Could not finish setup", { description: result.error });
        return;
      }
      router.push("/dashboard");
    });
  }

  return (
    <div className={cn("mx-auto w-full", step === "preview" ? "max-w-3xl" : "max-w-xl")}>
      <Stepper current={step} />

      <div className="mt-8 animate-rise" key={step}>
        {step === "details" ? (
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void toAddress();
            }}
          >
            <StepHeading title={`Welcome, ${firstName}. Tell us about your shop.`}>
              This appears at the top of your storefront. You can change everything later.
            </StepHeading>
            <div className="grid gap-5">
              <Field label="Shop name" error={errors.name?.message}>
                {(control) => (
                  <Input {...control} autoFocus autoComplete="organization" placeholder="Urban Mobile Studio" maxLength={60} {...register("name")} />
                )}
              </Field>
              <Field
                label="Area and city"
                error={errors.location?.message}
                hint="Helps customers know where to find you."
              >
                {(control) => (
                  <Input {...control} placeholder="Rajkamal Square, Amravati" maxLength={120} {...register("location")} />
                )}
              </Field>
              <Field
                label="WhatsApp number"
                error={errors.whatsappNumber?.message}
                hint="Customers tap “Inquire on WhatsApp” and their message arrives here."
              >
                {(control) => (
                  <AffixInput
                    {...control}
                    prefix="+91"
                    inputMode="tel"
                    autoComplete="tel-national"
                    placeholder="98765 43210"
                    maxLength={14}
                    {...register("whatsappNumber")}
                  />
                )}
              </Field>
              <Field label="Short description" optional error={errors.description?.message}>
                {(control) => (
                  <Textarea
                    {...control}
                    rows={3}
                    maxLength={240}
                    placeholder="Hand-checked pre-owned iPhones and flagship Androids."
                    {...register("description")}
                  />
                )}
              </Field>
            </div>
            <div className="mt-8 flex justify-end">
              <Button type="submit" size="lg" className="w-full sm:w-auto">
                Continue
                <ArrowRight />
              </Button>
            </div>
          </form>
        ) : null}

        {step === "address" ? (
          <form noValidate onSubmit={createShop}>
            <StepHeading title="Choose your storefront link">
              This is what you will paste into your Instagram bio and send on WhatsApp. Short and recognisable works
              best.
            </StepHeading>
            <Field
              label="Storefront address"
              error={errors.slug?.message}
              hint={slugStatus.state === "idle" ? "Lowercase letters, numbers and hyphens." : <SlugHint status={slugStatus} />}
            >
              {(control) => (
                <AffixInput
                  {...control}
                  autoFocus
                  prefix="/shop/"
                  className="font-mono"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={40}
                  value={slug}
                  onChange={(event) => {
                    setSlugTouched(true);
                    form.setValue("slug", event.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""), {
                      shouldValidate: formState.isSubmitted,
                    });
                  }}
                />
              )}
            </Field>
            <div className="mt-4 rounded-xl border bg-surface-2 px-4 py-3.5">
              <p className="eyebrow text-faint">Your link will be</p>
              <p className="mt-1 break-all font-mono text-sm">
                <span className="text-muted-foreground">{origin.replace(/^https?:\/\//, "")}/shop/</span>
                <span className="font-semibold">{slug || "your-shop"}</span>
              </p>
            </div>
            <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button variant="ghost" size="lg" onClick={() => setStep("details")} disabled={pending}>
                <ArrowLeft />
                Back
              </Button>
              <Button
                type="submit"
                size="lg"
                loading={pending}
                disabled={slugStatus.state === "taken" || slugStatus.state === "checking"}
              >
                Create my storefront
              </Button>
            </div>
          </form>
        ) : null}

        {step === "device" && shop ? (
          <>
            <StepHeading title="Add your first phone">
              Your storefront is live at <span className="font-mono text-[13px] text-foreground">/shop/{shop.slug}</span>.
              List one phone now so it has something to show. It takes about a minute.
            </StepHeading>
            <FirstDevice
              shopName={shop.name}
              showPricesByDefault={shop.showPricesByDefault}
              onDone={() => setStep("preview")}
              onSkip={() => setStep("preview")}
            />
          </>
        ) : null}

        {step === "preview" && shop ? (
          <>
            <StepHeading title="This is what customers will see">
              A live preview of your storefront, exactly as it opens on a phone. Scroll and tap around.
            </StepHeading>
            <div className="mx-auto w-full max-w-[23rem] rounded-[2.75rem] bg-foreground p-2.5 shadow-lg">
              <iframe
                src={`/shop/${shop.slug}?preview=1`}
                title={`Preview of ${shop.name}'s storefront`}
                className="h-[36rem] w-full rounded-[2.2rem] bg-background"
              />
            </div>
            <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
              <Button asChild variant="secondary" size="lg">
                <a href={`/shop/${shop.slug}?preview=1`} target="_blank" rel="noopener noreferrer">
                  Open in a new tab
                  <ExternalLink />
                </a>
              </Button>
              <Button size="lg" onClick={() => setStep("share")}>
                Looks good, continue
                <ArrowRight />
              </Button>
            </div>
          </>
        ) : null}

        {step === "share" && shop ? (
          <>
            <div className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong">
              <PartyPopper className="size-6" />
            </div>
            <StepHeading title="Your storefront is ready to share">
              Put this link wherever customers already ask you “is it available?”. From now on they can just look.
            </StepHeading>
            <ShareLink slug={shop.slug} shopName={shop.name} size="lg" />
            <ul className="mt-6 grid gap-2.5 text-sm">
              {[
                { icon: InstagramIcon, text: "Add it to your Instagram bio and story highlights." },
                { icon: Send, text: "Send it on WhatsApp when someone asks what is in stock." },
                { icon: Printer, text: "Print the QR code for your counter and shop window." },
              ].map((tip) => (
                <li key={tip.text} className="flex items-center gap-3 rounded-lg border bg-surface px-3.5 py-3">
                  <tip.icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                  {tip.text}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button variant="ghost" size="lg" onClick={() => setStep("preview")} disabled={finishing}>
                <ArrowLeft />
                Back to preview
              </Button>
              <Button size="lg" onClick={finish} loading={finishing}>
                {finishing ? null : <Check />}
                Go to my dashboard
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
