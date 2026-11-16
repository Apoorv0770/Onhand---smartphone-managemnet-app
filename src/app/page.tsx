import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Fingerprint,
  Link2,
  MessagesSquare,
  MousePointerClick,
  QrCode,
  ScanSearch,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  Timer,
  TrendingUp,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { WhatsAppIcon } from "@/components/brand/icons";
import { Logo } from "@/components/brand/logo";
import { BatteryBadge, StatusBadge } from "@/components/device/badges";
import { DeviceVisual } from "@/components/device/device-visual";
import { CUSTOMER_QUESTIONS, SHOWCASE_DEVICES } from "@/components/marketing/demo-data";
import { HeroDemo } from "@/components/marketing/hero-demo";
import { CoverSwitcher, Faq, PriceToggleDemo } from "@/components/marketing/interactive";
import { MarketingNav } from "@/components/marketing/nav";
import { Button } from "@/components/ui/button";
import { CONDITION_LABEL } from "@/lib/catalog";
import { deviceSpecLine, deviceTitle } from "@/lib/device";
import { formatPrice } from "@/lib/format";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";
import { SEED_BUSINESSES } from "@/server/backend/seed-data";

export const metadata: Metadata = {
  title: { absolute: `${site.name} — ${site.tagline}` },
  description: site.description,
  alternates: { canonical: "/" },
};

const DEMO_URL = `/shop/${site.demoShopSlug}`;

const FAQ_ITEMS = [
  {
    question: `Is ${site.name} a marketplace or a classifieds site?`,
    answer:
      "No. Every shop gets its own storefront at its own link, and a customer who opens it sees only that shop’s phones. Your stock is never listed next to another retailer’s, and there is no shared search across shops.",
  },
  {
    question: "Do my customers need an app or an account?",
    answer:
      "No. Your storefront is a normal web link. It opens in any phone browser straight from Instagram or WhatsApp, with nothing to install and nothing to sign up for.",
  },
  {
    question: "Can I keep my prices private?",
    answer:
      "Yes. Each phone has its own switch. When it is off, customers see “Price on request” and can message you for it. The hidden price stays in your dashboard and is never sent to the storefront.",
  },
  {
    question: "What happens when a phone sells?",
    answer:
      "Tap “Mark sold” next to it in your inventory. Your storefront shows it as sold straight away. You decide whether sold phones stay visible, marked as sold, or disappear from the catalog.",
  },
  {
    question: "Why is every phone a separate entry?",
    answer:
      "Because no two used phones are the same. Two iPhone 13s with the same storage can have different battery health, different marks and different prices, so each physical phone gets its own record and its own reference.",
  },
  {
    question: "Can I manage everything from my phone?",
    answer:
      "Yes. The dashboard is built for a phone screen first: add a device, take photos with your camera and mark things sold from behind the counter.",
  },
  {
    question: "How much does it cost?",
    answer:
      "Pricing has not been announced yet. This is an early version of the product that you can try end to end, including the demo storefronts.",
  },
  {
    question: "Are the shops in the demo real?",
    answer:
      "No. Urban Mobile Studio, Prime Device Hub and NextWave Mobiles are fictional retailers created to show how a storefront looks and works. Their phones, prices and contact details are made up.",
  },
];

/* --------------------------------- Pieces --------------------------------- */

function SectionHeading({
  eyebrow,
  title,
  children,
  align = "left",
  className,
}: {
  eyebrow: string;
  title: React.ReactNode;
  children?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      <p className="eyebrow text-brand-strong">{eyebrow}</p>
      <h2 className="mt-3 text-[32px] font-semibold leading-[1.08] tracking-[-0.035em] sm:text-[44px]">{title}</h2>
      {children ? <p className="mt-4 text-[17px] leading-7 text-muted-foreground">{children}</p> : null}
    </div>
  );
}

function BentoCard({
  title,
  children,
  visual,
  className,
}: {
  title: string;
  children: React.ReactNode;
  visual?: React.ReactNode;
  className?: string;
}) {
  return (
    <article className={cn("reveal flex flex-col overflow-hidden rounded-3xl border bg-surface shadow-xs", className)}>
      {visual ? <div className="relative border-b bg-surface-2/70 p-5 sm:p-6">{visual}</div> : null}
      <div className="p-5 sm:p-6">
        <h3 className="text-lg font-semibold leading-6 tracking-[-0.02em]">{title}</h3>
        <p className="mt-2 text-[15px] leading-6 text-muted-foreground">{children}</p>
      </div>
    </article>
  );
}

function ChatBubble({ children, mine = false }: { children: React.ReactNode; mine?: boolean }) {
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] px-3.5 py-2.5 text-[15px] leading-5 shadow-xs",
          mine
            ? "rounded-2xl rounded-br-md bg-[#d9fdd3] text-[#0f2e1a]"
            : "rounded-2xl rounded-bl-md border bg-surface text-foreground",
        )}
      >
        {children}
      </div>
    </div>
  );
}

/* ---------------------------------- Page ---------------------------------- */

export default function HomePage() {
  const twins = SHOWCASE_DEVICES.filter((device) => device.model === "iPhone 13");
  const demoShops = SEED_BUSINESSES.map((business) => ({ name: business.name, slug: business.slug }));

  return (
    <div className="flex min-h-dvh flex-col">
      <MarketingNav />

      <main className="flex-1">
        {/* --------------------------------- Hero -------------------------------- */}
        <section className="relative isolate overflow-hidden">
          <div aria-hidden className="bg-grid mask-fade-b absolute inset-x-0 top-0 -z-10 h-[44rem]" />
          <div
            aria-hidden
            className="absolute left-1/2 top-[-18rem] -z-10 size-[44rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--brand)_16%,transparent),transparent)]"
          />

          <div className="container-page pt-12 text-center sm:pt-20">
            <p className="inline-flex animate-rise items-center gap-2 rounded-full border bg-surface px-3 py-1.5 text-[13px] font-medium text-muted-foreground shadow-xs">
              <span aria-hidden className="size-1.5 rounded-full bg-brand" />
              For second-hand smartphone retailers in India
            </p>
            <h1 className="mx-auto mt-6 max-w-4xl animate-rise text-[44px] font-semibold leading-[1.02] tracking-[-0.045em] [animation-delay:60ms] sm:text-7xl lg:text-[84px]">
              Your inventory<span className="text-brand">.</span>
              <br />
              Always within reach<span className="text-brand">.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl animate-rise text-[17px] leading-7 text-muted-foreground [animation-delay:120ms] sm:text-lg">
              Turn repetitive stock inquiries into effortless browsing. Give your customers a beautiful,
              always-accessible catalog of the phones you have in stock.
            </p>
            <div className="mt-8 flex animate-rise flex-col items-center justify-center gap-2.5 [animation-delay:180ms] sm:flex-row">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/signup">
                  Create your storefront
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary" className="w-full sm:w-auto">
                <Link href={DEMO_URL}>Explore live demo</Link>
              </Button>
            </div>
            <p className="mt-4 animate-rise text-[13px] text-faint [animation-delay:240ms]">
              Opens in any phone browser. Your customers never install anything.
            </p>
          </div>

          <div className="container-page mt-12 animate-rise pb-20 [animation-delay:320ms] sm:mt-16 md:pb-32">
            <HeroDemo devices={SHOWCASE_DEVICES} />
          </div>
        </section>

        {/* ------------------------------- Problem ------------------------------- */}
        <section className="border-y bg-surface-2/60 py-20 sm:py-28">
          <div className="container-page grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <div className="reveal">
              <SectionHeading eyebrow="The problem" title="The same questions, on every call and in every DM.">
                A customer sees one phone on your Instagram and asks about five others. You answer, they ask again, and
                the phone you described may already be sold. It is time you could spend selling.
              </SectionHeading>
              <ul className="mt-8 grid gap-4">
                {[
                  {
                    before: "Repeating what is in stock on calls and chats",
                    after: "Customers check your catalog themselves, any time",
                  },
                  {
                    before: "Inquiries about phones that sold yesterday",
                    after: "Mark it sold once and every customer sees it",
                  },
                  {
                    before: "Typing storage, colour and battery health again and again",
                    after: "Every phone lists its own details, entered once",
                  },
                ].map((row) => (
                  <li key={row.before} className="grid gap-1.5 rounded-2xl border bg-surface p-4 shadow-xs">
                    <p className="text-sm text-muted-foreground line-through decoration-border-strong">{row.before}</p>
                    <p className="flex items-start gap-2 text-[15px] font-medium leading-6">
                      <Check aria-hidden className="mt-1 size-4 shrink-0 text-success" />
                      {row.after}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="reveal relative mx-auto w-full max-w-md">
              <div className="rounded-[2rem] border bg-background p-4 shadow-md sm:p-5">
                <div className="flex items-center gap-3 border-b pb-3.5">
                  <span className="flex size-9 items-center justify-center rounded-full bg-surface-3 text-xs font-semibold text-muted-foreground">
                    C
                  </span>
                  <div>
                    <p className="text-sm font-semibold leading-4">A customer</p>
                    <p className="mt-0.5 text-xs text-faint">Messages from one afternoon</p>
                  </div>
                </div>
                <div className="grid gap-2 py-4">
                  {CUSTOMER_QUESTIONS.map((question) => (
                    <ChatBubble key={question}>{question}</ChatBubble>
                  ))}
                  <div className="mt-2">
                    <ChatBubble mine>
                      <span className="block">Everything we have in stock is here:</span>
                      <span className="mt-2 block overflow-hidden rounded-xl bg-white/70 ring-1 ring-black/5">
                        <span className="flex items-center gap-2.5 px-3 py-2.5">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#2f4329] text-2xs font-semibold text-[#eaf3e2]">
                            UM
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-semibold leading-4">
                              Urban Mobile Studio
                            </span>
                            <span className="block truncate font-mono text-2xs leading-4 opacity-70">
                              /shop/urban-mobile-studio
                            </span>
                          </span>
                        </span>
                      </span>
                    </ChatBubble>
                  </div>
                </div>
                <p className="border-t pt-3.5 text-center text-[13px] font-medium text-muted-foreground">
                  One link answers all of them.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ----------------------------- How it works ---------------------------- */}
        <section id="how-it-works" className="scroll-mt-16 py-20 sm:py-28">
          <div className="container-page">
            <SectionHeading eyebrow="How it works" title="Three small habits. One catalog that is always right.">
              No inventory software to learn. If you can post a phone on Instagram, you can do this.
            </SectionHeading>

            <ol className="mt-12 grid gap-4 lg:grid-cols-3">
              <li className="reveal flex flex-col rounded-3xl border bg-surface p-6 shadow-xs">
                <span className="font-mono text-xs font-medium text-brand-strong">01</span>
                <h3 className="mt-3 text-xl font-semibold tracking-[-0.02em]">Add each phone once</h3>
                <p className="mt-2 text-[15px] leading-6 text-muted-foreground">
                  Brand, model, storage, colour and condition. Battery health, photos, accessories and warranty when
                  you have them.
                </p>
                <div aria-hidden className="mt-6 flex flex-wrap gap-1.5">
                  {["iPhone 14 Pro", "256 GB", "Deep Purple", "Excellent"].map((chip) => (
                    <span key={chip} className="inline-flex h-8 items-center rounded-full border bg-surface-2 px-3 text-[13px] font-medium">
                      {chip}
                    </span>
                  ))}
                  <span className="inline-flex h-8 items-center gap-1.5 rounded-full border bg-surface-2 px-3 text-[13px] font-medium">
                    <BatteryBadge health={92} />
                  </span>
                </div>
              </li>

              <li className="reveal flex flex-col rounded-3xl border bg-surface p-6 shadow-xs">
                <span className="font-mono text-xs font-medium text-brand-strong">02</span>
                <h3 className="mt-3 text-xl font-semibold tracking-[-0.02em]">Share one link</h3>
                <p className="mt-2 text-[15px] leading-6 text-muted-foreground">
                  Put it in your Instagram bio, send it on WhatsApp and print the QR code for your counter. It never
                  changes.
                </p>
                <div aria-hidden className="mt-6 flex items-center gap-2">
                  <span className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border bg-surface-2 px-3 font-mono text-[13px]">
                    <Link2 className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">/shop/your-shop</span>
                  </span>
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border bg-surface-2">
                    <QrCode className="size-5" />
                  </span>
                </div>
              </li>

              <li className="reveal flex flex-col rounded-3xl border bg-surface p-6 shadow-xs">
                <span className="font-mono text-xs font-medium text-brand-strong">03</span>
                <h3 className="mt-3 text-xl font-semibold tracking-[-0.02em]">Mark sold in one tap</h3>
                <p className="mt-2 text-[15px] leading-6 text-muted-foreground">
                  When a phone leaves the shop, tap once. Your storefront updates immediately, so nobody travels for a
                  phone that is gone.
                </p>
                <div aria-hidden className="mt-6 flex items-center gap-3 rounded-xl border bg-surface-2 p-2.5">
                  <DeviceVisual brand="Apple" model="iPhone 13" colour="Midnight" alt="" inset="p-[10%]" className="size-10 shrink-0 rounded-lg border" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">iPhone 13</p>
                    <p className="truncate text-xs text-muted-foreground">128 GB · Midnight</p>
                  </div>
                  <StatusBadge status="sold" size="sm" />
                </div>
              </li>
            </ol>
          </div>
        </section>

        {/* ------------------------------- Features ------------------------------ */}
        <section id="features" className="scroll-mt-16 border-t bg-surface-2/60 py-20 sm:py-28">
          <div className="container-page">
            <SectionHeading eyebrow="Features" title="Built around how people actually buy a used phone.">
              They want a specific model, in a specific storage, in good condition, inside a budget. Your catalog
              answers in that order.
            </SectionHeading>

            <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-6">
              <BentoCard
                className="lg:col-span-4"
                title="Search and filters that match the questions"
                visual={
                  <div aria-hidden className="grid gap-3">
                    <div className="flex h-11 items-center gap-2 rounded-full border bg-surface px-4 text-sm text-faint shadow-xs">
                      <ScanSearch className="size-4" />
                      <span className="text-foreground">iphone 14 256</span>
                      <span className="ml-auto text-xs">2 phones</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: "Apple", active: true },
                        { label: "256 GB", active: true },
                        { label: "Battery 90%+", active: true },
                        { label: "Samsung" },
                        { label: "Excellent" },
                        { label: "Under ₹65,000" },
                        { label: "Deep Purple" },
                      ].map((chip) => (
                        <span
                          key={chip.label}
                          className={cn(
                            "inline-flex h-8 items-center rounded-full border px-3 text-[13px] font-medium",
                            chip.active ? "border-foreground bg-foreground text-background" : "bg-surface",
                          )}
                        >
                          {chip.label}
                        </span>
                      ))}
                    </div>
                  </div>
                }
              >
                Customers search by model, storage or colour and narrow down by brand, battery health, condition and
                budget. Results update as they type, with no page reloads.
              </BentoCard>

              <BentoCard
                className="lg:col-span-2"
                title="You decide which prices are public"
                visual={<PriceToggleDemo />}
              >
                Show the price on one phone and keep another on request. A hidden price never leaves your dashboard.
              </BentoCard>

              <BentoCard
                className="lg:col-span-3"
                title="Every phone is its own record"
                visual={
                  <div aria-hidden className="grid gap-2">
                    {twins.map((device) => (
                      <div key={device.id} className="flex items-center gap-3 rounded-xl border bg-surface p-2.5 shadow-xs">
                        <DeviceVisual
                          brand={device.brand}
                          model={device.model}
                          colour={device.colour}
                          alt=""
                          inset="p-[10%]"
                          className="size-11 shrink-0 rounded-lg border"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium">{deviceTitle(device)}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {deviceSpecLine(device)} · {CONDITION_LABEL[device.condition]}
                          </p>
                        </div>
                        {device.batteryHealth !== null ? <BatteryBadge health={device.batteryHealth} /> : null}
                        <span className="tnum text-[13px] font-semibold">
                          {device.price !== null ? formatPrice(device.price) : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                }
              >
                Two iPhone 13s are not the same phone. Each unit carries its own battery health, condition, price and
                reference, so customers ask about the exact one they want.
              </BentoCard>

              <BentoCard
                className="lg:col-span-3"
                title="WhatsApp inquiries that name the exact phone"
                visual={
                  <div aria-hidden className="grid gap-2.5">
                    <ChatBubble mine>
                      Hi, I found the iPhone 14 Pro, 256 GB, Deep Purple on your catalog. Is this specific device still
                      available?
                      <span className="mt-1.5 block font-mono text-xs opacity-75">Ref: UMS-0014</span>
                    </ChatBubble>
                    <span className="inline-flex h-10 items-center justify-center gap-2 self-end justify-self-end rounded-lg bg-whatsapp px-4 text-sm font-medium text-whatsapp-foreground">
                      <WhatsAppIcon />
                      Inquire on WhatsApp
                    </span>
                  </div>
                }
              >
                One tap opens WhatsApp with the model, storage, colour and your inventory reference already written.
                No more “which one?”.
              </BentoCard>

              <BentoCard className="lg:col-span-2" title="Your storefront, only your stock">
                This is not a marketplace. A customer who opens your link sees your phones and nobody else’s. Your
                notes and hidden prices stay private to your account.
              </BentoCard>
              <BentoCard className="lg:col-span-2" title="Made for a phone in one hand">
                Most customers arrive from Instagram on a phone. Search stays within reach, filters open as a sheet and
                the inquiry button sits under the thumb.
              </BentoCard>
              <BentoCard className="lg:col-span-2" title="See what gets attention">
                Your dashboard counts real storefront visits and WhatsApp inquiry taps, and shows which phones people
                ask about most.
              </BentoCard>
            </div>
          </div>
        </section>

        {/* ----------------------------- Live preview ---------------------------- */}
        <section id="preview" className="scroll-mt-16 overflow-hidden py-20 sm:py-28">
          <div className="container-page grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-20">
            <div className="reveal">
              <SectionHeading eyebrow="Live preview" title="This is a working storefront, not a screenshot.">
                The phone on this page is running the real catalog of a demo shop. Search it, open the filters, tap a
                phone and try the WhatsApp button.
              </SectionHeading>
              <ul className="mt-8 grid gap-3 text-[15px]">
                {[
                  { icon: ScanSearch, text: "Search “pixel” or “256” and watch the results change" },
                  { icon: MousePointerClick, text: "Open a phone to see battery health, condition and what is included" },
                  { icon: MessagesSquare, text: "Tap “Inquire on WhatsApp” to see the message customers send" },
                ].map((item) => (
                  <li key={item.text} className="flex items-start gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-surface text-muted-foreground shadow-xs">
                      <item.icon aria-hidden className="size-4" />
                    </span>
                    <span className="pt-1 leading-6">{item.text}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
                <Button asChild size="lg">
                  <Link href={DEMO_URL}>
                    Open the full demo
                    <ArrowUpRight />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link href="/login">See the dashboard side</Link>
                </Button>
              </div>
              <p className="mt-4 text-[13px] text-faint">
                The demo shop and its inventory are fictional.
              </p>
            </div>

            <div className="reveal relative mx-auto">
              <div
                aria-hidden
                className="absolute -inset-10 -z-10 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--brand)_14%,transparent),transparent)]"
              />
              <div className="w-[21.5rem] max-w-full rounded-[3rem] bg-foreground p-2.5 shadow-lg ring-1 ring-black/10">
                <iframe
                  src={`${DEMO_URL}?preview=1`}
                  title="Live demo storefront for Urban Mobile Studio"
                  loading="lazy"
                  className="h-[40rem] w-full rounded-[2.4rem] bg-background"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------- Benefits ------------------------------ */}
        <section className="border-y bg-foreground py-20 text-background sm:py-28">
          <div className="container-page">
            <div className="max-w-2xl">
              <p className="eyebrow text-brand">What changes for your shop</p>
              <h2 className="mt-3 text-[32px] font-semibold leading-[1.08] tracking-[-0.035em] sm:text-[44px]">
                Less time answering. More time selling.
              </h2>
            </div>
            <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: Timer,
                  title: "Fewer repeat questions",
                  text: "Availability, storage, colour and battery health are already answered before anyone messages you.",
                },
                {
                  icon: Sparkles,
                  title: "A shop that looks established",
                  text: "A clean, branded catalog link in your bio says more than a highlight reel of old stories.",
                },
                {
                  icon: ShieldCheck,
                  title: "Stock customers can trust",
                  text: "What they see is what is on your shelf, because updating it takes one tap.",
                },
                {
                  icon: TrendingUp,
                  title: "Better conversations",
                  text: "People message about one specific phone with its reference, ready to talk price and pickup.",
                },
              ].map((benefit) => (
                <div key={benefit.title} className="reveal">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-background/10 text-background ring-1 ring-background/15">
                    <benefit.icon aria-hidden className="size-5" />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold tracking-[-0.02em]">{benefit.title}</h3>
                  <p className="mt-2 text-[15px] leading-6 text-background/65">{benefit.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------- Customise ----------------------------- */}
        <section id="customise" className="scroll-mt-16 py-20 sm:py-28">
          <div className="container-page grid items-center gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
            <div className="reveal">
              <SectionHeading eyebrow="Storefront customisation" title="Recognisably your shop.">
                Your name, your logo and your details lead the page. Try the cover styles here, or upload a banner
                photo of your own counter.
              </SectionHeading>
              <ul className="mt-8 grid gap-3 text-[15px] leading-6">
                {[
                  "Logo, shop name, location and a short description",
                  "Six cover styles, or your own banner photo",
                  "Opening hours with a live “Open now” indicator",
                  "WhatsApp, call and Instagram buttons",
                  "Your own link: /shop/your-shop",
                  "Choose whether sold phones stay visible",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check aria-hidden className="mt-1 size-4 shrink-0 text-success" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="reveal min-w-0">
              <CoverSwitcher />
            </div>
          </div>
        </section>

        {/* ------------------------------ Onboarding ----------------------------- */}
        <section className="border-t bg-surface-2/60 py-20 sm:py-28">
          <div className="container-page">
            <SectionHeading eyebrow="Getting started" title="From sign-up to a shareable link in a few minutes." align="center">
              Setup walks you through it one step at a time, and you can change everything afterwards.
            </SectionHeading>
            <ol className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                { icon: Fingerprint, title: "Create an account", text: "Your name, email and a password." },
                { icon: Store, title: "Describe your shop", text: "Name, area and WhatsApp number." },
                { icon: Link2, title: "Choose your link", text: "Pick a short address customers will remember." },
                { icon: Smartphone, title: "Add your first phone", text: "About a minute for the essentials." },
                { icon: QrCode, title: "Preview and share", text: "Copy the link or download the QR code." },
              ].map((step, index) => (
                <li key={step.title} className="reveal rounded-2xl border bg-surface p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-surface-2 text-foreground ring-1 ring-border">
                      <step.icon aria-hidden className="size-4" />
                    </span>
                    <span className="font-mono text-xs text-faint">0{index + 1}</span>
                  </div>
                  <h3 className="mt-4 text-[15px] font-semibold tracking-[-0.01em]">{step.title}</h3>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------------------------------- FAQ -------------------------------- */}
        <section id="faq" className="scroll-mt-16 py-20 sm:py-28">
          <div className="container-page grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
            <SectionHeading eyebrow="FAQ" title="Questions retailers ask first.">
              If yours is not here, open the demo and try it for yourself. It is the quickest answer.
            </SectionHeading>
            <Faq items={FAQ_ITEMS} />
          </div>
        </section>

        {/* ------------------------------- Final CTA ----------------------------- */}
        <section className="container-page pb-20 sm:pb-28">
          <div
            className="reveal relative isolate overflow-hidden rounded-[2rem] px-6 py-14 text-center text-white sm:rounded-[2.5rem] sm:px-12 sm:py-20"
            style={{
              background:
                "radial-gradient(120% 140% at 85% -20%, #4a4640 0%, transparent 55%), radial-gradient(90% 120% at 0% 110%, #5a2a16 0%, transparent 60%), linear-gradient(160deg, #262523 0%, #171615 100%)",
            }}
          >
            <div
              aria-hidden
              className="absolute inset-0 -z-10 bg-[radial-gradient(rgb(255_255_255/0.14)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(80%_100%_at_50%_0%,black,transparent_75%)]"
            />
            <h2 className="mx-auto max-w-2xl text-[34px] font-semibold leading-[1.06] tracking-[-0.04em] sm:text-[52px]">
              Let your catalog answer “is it available?”
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[17px] leading-7 text-white/70">
              Create your storefront, add the phones on your shelf and share one link.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
              <Button asChild size="lg" className="w-full bg-white text-[#171615] hover:bg-white/90 sm:w-auto">
                <Link href="/signup">
                  Create your storefront
                  <ArrowRight />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="w-full border-white/20 bg-white/10 text-white shadow-none hover:border-white/30 hover:bg-white/15 sm:w-auto"
              >
                <Link href={DEMO_URL}>Explore live demo</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* ---------------------------------- Footer -------------------------------- */}
      <footer className="border-t">
        <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-6 text-muted-foreground">
              A shareable, always up-to-date catalog for second-hand smartphone retailers.
            </p>
          </div>
          <nav aria-label="Product">
            <h2 className="eyebrow text-faint">Product</h2>
            <ul className="mt-4 grid gap-2.5 text-sm">
              <li><a href="#how-it-works" className="text-muted-foreground hover:text-foreground">How it works</a></li>
              <li><a href="#features" className="text-muted-foreground hover:text-foreground">Features</a></li>
              <li><a href="#customise" className="text-muted-foreground hover:text-foreground">Customisation</a></li>
              <li><a href="#faq" className="text-muted-foreground hover:text-foreground">FAQ</a></li>
            </ul>
          </nav>
          <nav aria-label="Demo storefronts">
            <h2 className="eyebrow text-faint">Demo storefronts</h2>
            <ul className="mt-4 grid gap-2.5 text-sm">
              {demoShops.map((shop) => (
                <li key={shop.slug}>
                  <Link href={`/shop/${shop.slug}`} className="text-muted-foreground hover:text-foreground">
                    {shop.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Account">
            <h2 className="eyebrow text-faint">Account</h2>
            <ul className="mt-4 grid gap-2.5 text-sm">
              <li><Link href="/signup" className="text-muted-foreground hover:text-foreground">Create your storefront</Link></li>
              <li><Link href="/login" className="text-muted-foreground hover:text-foreground">Log in</Link></li>
            </ul>
          </nav>
        </div>
        <div className="border-t">
          <p className="container-page py-5 text-[13px] leading-5 text-faint">
            The retailers, phones, prices and contact details shown in the demo are fictional and exist only to
            illustrate the product.
          </p>
        </div>
      </footer>
    </div>
  );
}
