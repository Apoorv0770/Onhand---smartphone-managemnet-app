import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { DeviceRender } from "@/components/device/device-render";
import { site } from "@/lib/site";

const SHOWCASE = [
  { brand: "Apple", model: "iPhone 15 Pro", colour: "Natural Titanium", className: "left-[6%] top-[14%] h-[58%] -rotate-[10deg]" },
  { brand: "Samsung", model: "Galaxy S23 Ultra", colour: "Green", className: "right-[4%] top-[8%] h-[54%] rotate-[9deg]" },
  { brand: "Apple", model: "iPhone 14 Pro", colour: "Deep Purple", className: "left-[31%] top-[26%] h-[66%] rotate-[2deg]" },
];

/** Two-column frame shared by every account page. */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-5 pb-10 pt-5 sm:px-10">
        <header>
          <Link href="/" aria-label={`${site.name} home`} className="inline-flex rounded-md">
            <Logo />
          </Link>
        </header>
        <main className="mx-auto flex w-full max-w-[23rem] flex-1 flex-col justify-center py-10">
          <h1 className="text-[28px] font-semibold leading-9 tracking-[-0.03em]">{title}</h1>
          <p className="mt-2 text-[15px] leading-6 text-muted-foreground">{description}</p>
          <div className="mt-7">{children}</div>
          {footer ? <div className="mt-7 text-sm text-muted-foreground">{footer}</div> : null}
        </main>
      </div>

      <aside aria-hidden className="relative hidden overflow-hidden border-l bg-surface-2 lg:block">
        <div className="bg-grid mask-fade-edges absolute inset-0" />
        <div className="absolute inset-x-0 top-0 h-[70%]">
          {SHOWCASE.map((device) => (
            <div key={device.model} className={`absolute drop-shadow-[0_30px_40px_rgb(30_25_20/0.18)] ${device.className}`}>
              <DeviceRender brand={device.brand} model={device.model} colour={device.colour} />
            </div>
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-surface-2 via-surface-2/95 to-transparent px-12 pb-14 pt-24">
          <p className="max-w-md text-[32px] font-semibold leading-[1.1] tracking-[-0.035em]">{site.tagline}</p>
          <p className="mt-3 max-w-sm text-[15px] leading-6 text-muted-foreground">
            A shareable catalog of the phones you have in stock, updated the moment something sells.
          </p>
        </div>
      </aside>
    </div>
  );
}
