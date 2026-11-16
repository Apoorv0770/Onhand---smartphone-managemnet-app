"use client";

import { PackageOpen, Search, SearchX, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/controls";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Drawer, DrawerBody, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/sheet";
import { CONDITION_LABEL } from "@/lib/catalog";
import { formatPrice, formatStorage, plural } from "@/lib/format";
import { useDebounced, useEmbeddedPreview, useOrigin } from "@/lib/hooks";
import { siteUrl } from "@/lib/site";
import type { PublicDevice, PublicShop } from "@/lib/types";
import { buildGeneralMessage } from "@/lib/whatsapp";
import {
  activeFilterCount,
  buildFacets,
  CATALOG_PARAM_KEYS,
  type CatalogFilters,
  EMPTY_FILTERS,
  hasAnyFilter,
  matchesFilters,
  parseCatalogParams,
  serialiseCatalogParams,
  SORT_OPTIONS,
  type SortKey,
  sortDevices,
  toggle,
} from "./catalog-state";
import { trackStorefrontEvent, WhatsAppButton } from "./contact";
import { DeviceCard } from "./device-card";
import { FilterPanel } from "./filter-panel";
import { DemoRibbon, ShopHeader } from "./shop-header";
import { StorefrontFooter } from "./storefront-footer";

const PAGE_SIZE = 24;
const REFRESH_MS = 45_000;

function sameCatalog(a: PublicDevice[], b: PublicDevice[]): boolean {
  return a.length === b.length && JSON.stringify(a) === JSON.stringify(b);
}

interface ActiveChip {
  key: string;
  label: string;
  remove: () => void;
}

export function Storefront({
  shop,
  initialDevices,
  serverNow,
}: {
  shop: PublicShop;
  initialDevices: PublicDevice[];
  serverNow: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const origin = useOrigin(siteUrl());

  /* ------------------------------ Live catalog ----------------------------- */

  const [devices, setDevices] = useState(initialDevices);
  const [seenInitial, setSeenInitial] = useState(initialDevices);
  if (seenInitial !== initialDevices) {
    setSeenInitial(initialDevices);
    setDevices(initialDevices);
  }

  const lastRefresh = useRef(0);
  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      if (document.visibilityState !== "visible") return;
      lastRefresh.current = performance.now();
      try {
        const response = await fetch(`/api/public/shops/${shop.slug}`, { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { devices: PublicDevice[] };
        if (!cancelled && Array.isArray(data.devices)) {
          setDevices((current) => (sameCatalog(current, data.devices) ? current : data.devices));
        }
      } catch {
        // Offline or a blip: keep showing what we have.
      }
    }

    // First mount shows fresh server data. Coming back to this page later
    // (it stays mounted in the background) checks for changes right away.
    if (lastRefresh.current === 0) lastRefresh.current = performance.now();
    else if (performance.now() - lastRefresh.current > 8_000) void refresh();

    const interval = window.setInterval(refresh, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible" && performance.now() - lastRefresh.current > 8_000) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [shop.slug]);

  /* -------------------------------- Analytics ------------------------------ */

  useEmbeddedPreview();

  const isPreview = searchParams.get("preview") === "1";
  useEffect(() => {
    if (isPreview) return;
    const key = `onhand:viewed:${shop.slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Storage can be unavailable (private mode). Count the view anyway.
    }
    trackStorefrontEvent(shop.slug, "view");
  }, [shop.slug, isPreview]);

  /* --------------------------- Filters, sort, URL -------------------------- */

  const [{ filters, sort }, setState] = useState(() => parseCatalogParams(new URLSearchParams(searchParams.toString())));
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Set once the customer changes something. Until then the URL is left as
  // it arrived, including any campaign parameters from the link they tapped.
  const [touched, setTouched] = useState(false);

  function update(patch: Partial<CatalogFilters>) {
    setTouched(true);
    setVisible(PAGE_SIZE);
    setState((current) => {
      const next = { ...current.filters, ...patch };
      // Drop selected models that no longer belong to the chosen brands.
      if (patch.brands && next.brands.length && next.models.length) {
        const allowed = new Set(devices.filter((device) => next.brands.includes(device.brand)).map((d) => d.model));
        next.models = next.models.filter((model) => allowed.has(model));
      }
      return { ...current, filters: next };
    });
  }

  function setSort(next: SortKey) {
    setTouched(true);
    setVisible(PAGE_SIZE);
    setState((current) => ({ ...current, sort: next }));
  }

  function clearAll() {
    setTouched(true);
    setVisible(PAGE_SIZE);
    setState((current) => ({ ...current, filters: EMPTY_FILTERS }));
  }

  const query = serialiseCatalogParams(filters, sort);
  const debouncedQuery = useDebounced(query, 250);
  useEffect(() => {
    if (!touched) return;
    const params = new URLSearchParams(window.location.search);
    for (const key of CATALOG_PARAM_KEYS) params.delete(key);
    new URLSearchParams(debouncedQuery).forEach((value, key) => params.set(key, value));
    const search = params.toString();
    const target = search ? `${pathname}?${search}` : pathname;
    if (`${window.location.pathname}${window.location.search}` !== target) {
      window.history.replaceState(null, "", target);
    }
  }, [debouncedQuery, pathname, touched]);

  const deferredFilters = useDeferredValue(filters);
  const facets = useMemo(() => buildFacets(devices, deferredFilters), [devices, deferredFilters]);
  const results = useMemo(
    () =>
      sortDevices(
        devices.filter((device) => matchesFilters(device, deferredFilters)),
        sort,
      ),
    [devices, deferredFilters, sort],
  );

  const sortOptions = SORT_OPTIONS.filter(
    (option) =>
      !option.needs ||
      (option.needs === "price" ? facets.hasPrices : facets.hasBattery) ||
      option.value === sort,
  );
  const filterCount = activeFilterCount(filters);
  const shown = results.slice(0, visible);
  const availableCount = devices.filter((device) => device.availability === "available").length;
  const missingBattery = sort === "battery" && results.some((device) => device.batteryHealth === null);
  const missingPrice = sort.startsWith("price") && results.some((device) => device.price === null);

  const chips: ActiveChip[] = [
    ...filters.statuses.map((value) => ({
      key: `status-${value}`,
      label: value === "available" ? "Available" : value === "reserved" ? "Reserved" : "Sold",
      remove: () => update({ statuses: toggle(filters.statuses, value) }),
    })),
    ...filters.brands.map((value) => ({
      key: `brand-${value}`,
      label: value,
      remove: () => update({ brands: toggle(filters.brands, value) }),
    })),
    ...filters.models.map((value) => ({
      key: `model-${value}`,
      label: value,
      remove: () => update({ models: toggle(filters.models, value) }),
    })),
    ...filters.storages.map((value) => ({
      key: `storage-${value}`,
      label: formatStorage(value),
      remove: () => update({ storages: toggle(filters.storages, value) }),
    })),
    ...(filters.priceMin !== null || filters.priceMax !== null
      ? [
          {
            key: "price",
            label:
              filters.priceMin !== null && filters.priceMax !== null
                ? `${formatPrice(filters.priceMin)} – ${formatPrice(filters.priceMax)}`
                : filters.priceMin !== null
                  ? `From ${formatPrice(filters.priceMin)}`
                  : `Up to ${formatPrice(filters.priceMax ?? 0)}`,
            remove: () => update({ priceMin: null, priceMax: null }),
          },
        ]
      : []),
    ...(filters.minBattery !== null
      ? [
          {
            key: "battery",
            label: `Battery ${filters.minBattery}%+`,
            remove: () => update({ minBattery: null }),
          },
        ]
      : []),
    ...filters.conditions.map((value) => ({
      key: `condition-${value}`,
      label: CONDITION_LABEL[value],
      remove: () => update({ conditions: toggle(filters.conditions, value) }),
    })),
    ...filters.colours.map((value) => ({
      key: `colour-${value}`,
      label: value,
      remove: () => update({ colours: toggle(filters.colours, value) }),
    })),
  ];

  const generalMessage = buildGeneralMessage(shop.name, `${origin}/shop/${shop.slug}`);

  return (
    <div className="flex min-h-dvh flex-col">
      {shop.isDemo ? <DemoRibbon /> : null}
      <ShopHeader shop={shop} serverNow={serverNow} />

      <main id="catalog" className="container-page flex-1 pb-16 pt-6 sm:pt-8">
        {devices.length === 0 ? (
          <EmptyState
            icon={<PackageOpen />}
            title="No phones listed yet"
            description={`${shop.name} has not added any phones to this catalog yet. Message the shop to ask what is in stock.`}
          >
            <WhatsAppButton shop={shop} message={generalMessage} label="Ask on WhatsApp" />
          </EmptyState>
        ) : (
          <>
            <div className="mb-1 flex items-baseline justify-between gap-4">
              <h2 className="text-xl font-semibold tracking-[-0.025em] sm:text-2xl">Phones in stock</h2>
              <p className="tnum shrink-0 text-[13px] text-muted-foreground">
                {plural(availableCount, "phone")} available
              </p>
            </div>

            {/* Sticky search and quick filters */}
            <div className="sticky top-0 z-30 -mx-4 bg-background/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
              <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search
                    aria-hidden
                    className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint"
                  />
                  <input
                    type="search"
                    inputMode="search"
                    enterKeyHint="search"
                    autoComplete="off"
                    spellCheck={false}
                    aria-label="Search phones by brand, model, storage or colour"
                    placeholder="Search phones"
                    value={filters.q}
                    onChange={(event) => update({ q: event.target.value })}
                    className="h-11 w-full rounded-full border border-border-strong/80 bg-surface pl-10 pr-10 text-base shadow-xs outline-none transition-[border-color,box-shadow] placeholder:text-faint hover:border-border-strong focus-visible:border-foreground/45 focus-visible:ring-4 focus-visible:ring-ring/15 md:text-sm"
                  />
                  {filters.q ? (
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={() => update({ q: "" })}
                      className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-3 hover:text-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  ) : null}
                </div>
                <Button
                  variant="secondary"
                  className="h-11 shrink-0 rounded-full px-4 lg:hidden"
                  onClick={() => setDrawerOpen(true)}
                  aria-haspopup="dialog"
                >
                  <SlidersHorizontal />
                  Filters
                  {filterCount > 0 ? (
                    <span className="tnum flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-2xs font-semibold text-background">
                      {filterCount}
                    </span>
                  ) : null}
                </Button>
              </div>

              {facets.brands.length > 1 ? (
                <div className="no-scrollbar -mx-4 mt-2.5 flex gap-1.5 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:hidden">
                  <Chip
                    selected={filters.brands.length === 0}
                    onClick={() => update({ brands: [], models: [] })}
                    className="h-9"
                  >
                    All
                  </Chip>
                  {facets.brands.map((brand) => (
                    <Chip
                      key={brand.value}
                      selected={filters.brands.includes(brand.value)}
                      onClick={() => update({ brands: toggle(filters.brands, brand.value) })}
                      className="h-9"
                    >
                      {brand.label}
                    </Chip>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mt-2 lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:gap-10">
              {/* Desktop filters */}
              <aside aria-label="Filters" className="hidden lg:block">
                <div className="scrollbar-thin sticky top-[4.75rem] max-h-[calc(100dvh-5.75rem)] overflow-y-auto overscroll-contain pb-6 pr-3">
                  <div className="mb-4 flex h-9 items-center justify-between">
                    <h2 className="text-sm font-semibold">Filters</h2>
                    {filterCount > 0 ? (
                      <Button variant="ghost" size="sm" onClick={clearAll} className="-mr-2">
                        Clear all
                      </Button>
                    ) : null}
                  </div>
                  <FilterPanel filters={filters} facets={facets} onChange={update} />
                </div>
              </aside>

              <section aria-label="Results" className="min-w-0">
                <div className="flex min-h-9 items-center justify-between gap-3">
                  <p aria-live="polite" className="tnum text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{plural(results.length, "phone")}</span>
                    {hasAnyFilter(filters) ? ` of ${devices.length}` : ""}
                  </p>
                  <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
                    <SelectTrigger size="sm" aria-label="Sort phones" className="w-auto gap-1.5 rounded-full border-transparent bg-transparent pl-3 pr-2.5 shadow-none hover:border-transparent hover:bg-surface-3">
                      <span className="text-muted-foreground">Sort:</span>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="end">
                      {sortOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {chips.length > 0 ? (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {chips.map((chip) => (
                      <button
                        key={chip.key}
                        type="button"
                        onClick={chip.remove}
                        aria-label={`Remove filter: ${chip.label}`}
                        className="inline-flex h-7 items-center gap-1 rounded-full bg-surface-3 pl-2.5 pr-1.5 text-xs font-medium transition-colors hover:bg-border"
                      >
                        {chip.label}
                        <X aria-hidden className="size-3.5 text-muted-foreground" />
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={clearAll}
                      className="h-7 rounded-full px-2 text-xs font-medium text-brand-strong underline-offset-4 hover:underline"
                    >
                      Clear all
                    </button>
                  </div>
                ) : null}

                {missingBattery || missingPrice ? (
                  <p className="mt-2 text-xs text-faint">
                    {missingBattery
                      ? "Phones that do not list battery health appear last."
                      : "Phones without a listed price appear last."}
                  </p>
                ) : null}

                {results.length === 0 ? (
                  <EmptyState
                    className="mt-4"
                    icon={<SearchX />}
                    title="No matching phones found"
                    description="Try adjusting your filters, or ask the shop directly. New phones are added often."
                  >
                    <Button variant="secondary" onClick={clearAll}>
                      Clear search and filters
                    </Button>
                    <WhatsAppButton shop={shop} message={generalMessage} label="Ask on WhatsApp" />
                  </EmptyState>
                ) : (
                  <>
                    <ul
                      key={query}
                      className="mt-4 grid animate-rise grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4"
                    >
                      {shown.map((device, index) => (
                        <li key={device.id} className="flex">
                          <DeviceCard device={device} shopSlug={shop.slug} eager={index < 4} className="w-full" />
                        </li>
                      ))}
                    </ul>
                    {results.length > shown.length ? (
                      <div className="mt-8 flex flex-col items-center gap-2">
                        <Button variant="secondary" size="lg" onClick={() => setVisible((count) => count + PAGE_SIZE)}>
                          Show more phones
                        </Button>
                        <p className="tnum text-xs text-faint">
                          Showing {shown.length} of {results.length}
                        </p>
                      </div>
                    ) : null}
                  </>
                )}
              </section>
            </div>
          </>
        )}
      </main>

      <StorefrontFooter shop={shop} />

      {/* Mobile filters */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="lg:hidden">
          <DrawerHeader>
            <div>
              <DrawerTitle>Filters</DrawerTitle>
              <DrawerDescription className="sr-only">Narrow the catalog by brand, storage, price and more.</DrawerDescription>
            </div>
            {filterCount > 0 ? (
              <Button variant="ghost" size="sm" onClick={clearAll}>
                Clear all
              </Button>
            ) : null}
          </DrawerHeader>
          <DrawerBody>
            <FilterPanel filters={filters} facets={facets} onChange={update} className="pb-2 pt-1" />
          </DrawerBody>
          <DrawerFooter>
            <Button size="lg" className="flex-1" onClick={() => setDrawerOpen(false)}>
              Show {plural(results.length, "phone")}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
