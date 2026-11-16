import { AVAILABILITY_RANK, CONDITION_LABEL, CONDITION_RANK } from "@/lib/catalog";
import { deviceTitle } from "@/lib/device";
import { formatStorage } from "@/lib/format";
import type { AvailabilityStatus, DeviceCondition, PublicDevice } from "@/lib/types";

/* ---------------------------------------------------------------------------
   Catalog search, filtering, sorting and facet counts.
   Pure functions over the public device list, so they are easy to test and
   run instantly in the browser with no round trip per keystroke.
--------------------------------------------------------------------------- */

export type SortKey = "recent" | "price-asc" | "price-desc" | "brand" | "model" | "storage" | "battery";

export interface CatalogFilters {
  q: string;
  brands: string[];
  models: string[];
  storages: number[];
  colours: string[];
  conditions: DeviceCondition[];
  statuses: AvailabilityStatus[];
  /** Minimum battery health percentage, or null for any. */
  minBattery: number | null;
  priceMin: number | null;
  priceMax: number | null;
}

export const EMPTY_FILTERS: CatalogFilters = {
  q: "",
  brands: [],
  models: [],
  storages: [],
  colours: [],
  conditions: [],
  statuses: [],
  minBattery: null,
  priceMin: null,
  priceMax: null,
};

export const BATTERY_STEPS = [80, 85, 90, 95] as const;

export const SORT_OPTIONS: { value: SortKey; label: string; needs?: "price" | "battery" }[] = [
  { value: "recent", label: "Recently added" },
  { value: "price-asc", label: "Price: low to high", needs: "price" },
  { value: "price-desc", label: "Price: high to low", needs: "price" },
  { value: "brand", label: "Brand: A to Z" },
  { value: "model", label: "Model: A to Z" },
  { value: "storage", label: "Storage: high to low" },
  { value: "battery", label: "Battery health: high to low", needs: "battery" },
];

type FacetKey = "brands" | "models" | "storages" | "colours" | "conditions" | "statuses" | "battery" | "price";

const CONDITIONS = Object.keys(CONDITION_LABEL) as DeviceCondition[];
const STATUSES: AvailabilityStatus[] = ["available", "reserved", "sold"];

function colourKey(colour: string): string {
  return colour.trim().toLowerCase();
}

function searchText(device: PublicDevice): { spaced: string; compact: string } {
  const storage = formatStorage(device.storageGb).toLowerCase();
  const spaced = [
    device.brand,
    deviceTitle(device),
    storage,
    storage.replace(" ", ""),
    device.colour,
    device.reference,
    CONDITION_LABEL[device.condition],
  ]
    .join(" ")
    .toLowerCase();
  return { spaced, compact: spaced.replace(/\s+/g, "") };
}

export function matchesQuery(device: PublicDevice, query: string): boolean {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const text = searchText(device);
  return tokens.every((token) => text.spaced.includes(token) || text.compact.includes(token));
}

/** Whether a device passes every active filter, optionally ignoring one facet. */
export function matchesFilters(device: PublicDevice, filters: CatalogFilters, ignore?: FacetKey): boolean {
  if (!matchesQuery(device, filters.q)) return false;
  if (ignore !== "brands" && filters.brands.length && !filters.brands.includes(device.brand)) return false;
  if (ignore !== "models" && filters.models.length && !filters.models.includes(device.model)) return false;
  if (ignore !== "storages" && filters.storages.length && !filters.storages.includes(device.storageGb)) return false;
  if (
    ignore !== "colours" &&
    filters.colours.length &&
    !filters.colours.some((colour) => colourKey(colour) === colourKey(device.colour))
  ) {
    return false;
  }
  if (ignore !== "conditions" && filters.conditions.length && !filters.conditions.includes(device.condition)) {
    return false;
  }
  if (ignore !== "statuses" && filters.statuses.length && !filters.statuses.includes(device.availability)) {
    return false;
  }
  if (ignore !== "battery" && filters.minBattery !== null) {
    if (device.batteryHealth === null || device.batteryHealth < filters.minBattery) return false;
  }
  if (ignore !== "price" && (filters.priceMin !== null || filters.priceMax !== null)) {
    if (device.price === null) return false;
    if (filters.priceMin !== null && device.price < filters.priceMin) return false;
    if (filters.priceMax !== null && device.price > filters.priceMax) return false;
  }
  return true;
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
}

/** Missing values always sort last, whatever the direction. */
function compareNullable(a: number | null, b: number | null, direction: 1 | -1): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return (a - b) * direction;
}

export function sortDevices(devices: PublicDevice[], sort: SortKey): PublicDevice[] {
  const byRecent = (a: PublicDevice, b: PublicDevice) => b.addedAt.localeCompare(a.addedAt);
  const soldLast = (a: PublicDevice, b: PublicDevice) =>
    Number(a.availability === "sold") - Number(b.availability === "sold");

  const comparator = (a: PublicDevice, b: PublicDevice): number => {
    switch (sort) {
      case "price-asc":
        return compareNullable(a.price, b.price, 1);
      case "price-desc":
        return compareNullable(a.price, b.price, -1);
      case "brand":
        return compareText(a.brand, b.brand) || compareText(deviceTitle(a), deviceTitle(b));
      case "model":
        // By the model name, which is what a storefront card shows as its
        // heading. The full title would put every Apple phone under "i" and
        // sort everything else by brand.
        return compareText(a.model, b.model) || compareText(a.brand, b.brand);
      case "storage":
        return b.storageGb - a.storageGb;
      case "battery":
        return compareNullable(a.batteryHealth, b.batteryHealth, -1);
      default:
        return AVAILABILITY_RANK[a.availability] - AVAILABILITY_RANK[b.availability];
    }
  };

  return [...devices].sort((a, b) => soldLast(a, b) || comparator(a, b) || byRecent(a, b));
}

export interface FacetOption<T> {
  value: T;
  label: string;
  /** How many devices would match if this option were selected. */
  count: number;
}

export interface Facets {
  brands: FacetOption<string>[];
  models: FacetOption<string>[];
  storages: FacetOption<number>[];
  colours: FacetOption<string>[];
  conditions: FacetOption<DeviceCondition>[];
  statuses: FacetOption<AvailabilityStatus>[];
  battery: FacetOption<number>[];
  /** Lowest and highest public price in the catalog, or null when none are public. */
  priceBounds: [number, number] | null;
  hasBattery: boolean;
  hasPrices: boolean;
}

function tally<T extends string | number>(
  pool: PublicDevice[],
  pick: (device: PublicDevice) => T,
): Map<T, number> {
  const counts = new Map<T, number>();
  for (const device of pool) {
    const key = pick(device);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * Options for every filter, each counted against the other active filters,
 * so a customer always sees how many phones a choice would leave.
 */
export function buildFacets(devices: PublicDevice[], filters: CatalogFilters): Facets {
  const pool = (ignore: FacetKey) => devices.filter((device) => matchesFilters(device, filters, ignore));

  const brandCounts = tally(pool("brands"), (device) => device.brand);
  const brands = [...new Set(devices.map((device) => device.brand))]
    .map((value) => ({ value, label: value, count: brandCounts.get(value) ?? 0 }))
    .sort((a, b) => b.count - a.count || compareText(a.label, b.label));

  const modelPool = pool("models");
  const modelCounts = tally(modelPool, (device) => device.model);
  const modelSource = filters.brands.length
    ? devices.filter((device) => filters.brands.includes(device.brand))
    : devices;
  const modelTitles = new Map<string, string>();
  for (const device of modelSource) modelTitles.set(device.model, deviceTitle(device));
  const models = [...modelTitles.entries()]
    .map(([value, label]) => ({ value, label, count: modelCounts.get(value) ?? 0 }))
    .sort((a, b) => compareText(a.label, b.label));

  const storageCounts = tally(pool("storages"), (device) => device.storageGb);
  const storages = [...new Set(devices.map((device) => device.storageGb))]
    .sort((a, b) => a - b)
    .map((value) => ({ value, label: formatStorage(value), count: storageCounts.get(value) ?? 0 }));

  const colourCounts = tally(pool("colours"), (device) => colourKey(device.colour));
  const colourNames = new Map<string, string>();
  for (const device of devices) {
    if (!colourNames.has(colourKey(device.colour))) colourNames.set(colourKey(device.colour), device.colour.trim());
  }
  const colours = [...colourNames.entries()]
    .map(([key, label]) => ({ value: label, label, count: colourCounts.get(key) ?? 0 }))
    .sort((a, b) => compareText(a.label, b.label));

  const conditionCounts = tally(pool("conditions"), (device) => device.condition);
  const presentConditions = new Set(devices.map((device) => device.condition));
  const conditions = CONDITIONS.filter((value) => presentConditions.has(value))
    .sort((a, b) => CONDITION_RANK[a] - CONDITION_RANK[b])
    .map((value) => ({ value, label: CONDITION_LABEL[value], count: conditionCounts.get(value) ?? 0 }));

  const statusCounts = tally(pool("statuses"), (device) => device.availability);
  const presentStatuses = new Set(devices.map((device) => device.availability));
  const statuses = STATUSES.filter((value) => presentStatuses.has(value)).map((value) => ({
    value,
    label: value === "available" ? "Available" : value === "reserved" ? "Reserved" : "Sold",
    count: statusCounts.get(value) ?? 0,
  }));

  const batteryPool = pool("battery");
  const battery = BATTERY_STEPS.map((value) => ({
    value,
    label: `${value}%+`,
    count: batteryPool.filter((device) => device.batteryHealth !== null && device.batteryHealth >= value).length,
  }));

  const prices = devices.map((device) => device.price).filter((price): price is number => price !== null);

  return {
    brands,
    models,
    storages,
    colours,
    conditions,
    statuses,
    battery,
    priceBounds: prices.length ? [Math.min(...prices), Math.max(...prices)] : null,
    hasBattery: devices.some((device) => device.batteryHealth !== null),
    hasPrices: prices.length > 0,
  };
}

export function activeFilterCount(filters: CatalogFilters): number {
  return (
    filters.brands.length +
    filters.models.length +
    filters.storages.length +
    filters.colours.length +
    filters.conditions.length +
    filters.statuses.length +
    (filters.minBattery !== null ? 1 : 0) +
    (filters.priceMin !== null || filters.priceMax !== null ? 1 : 0)
  );
}

export function hasAnyFilter(filters: CatalogFilters): boolean {
  return filters.q.trim() !== "" || activeFilterCount(filters) > 0;
}

/* ------------------------------- URL sync --------------------------------- */

/** Query keys owned by the catalog. Anything else in the URL is left alone. */
export const CATALOG_PARAM_KEYS = [
  "q",
  "brand",
  "model",
  "storage",
  "colour",
  "condition",
  "status",
  "battery",
  "min",
  "max",
  "sort",
] as const;

function list(value: string | null): string[] {
  return value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function positiveInt(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function parseCatalogParams(params: URLSearchParams): { filters: CatalogFilters; sort: SortKey } {
  const sortParam = params.get("sort");
  const sort = SORT_OPTIONS.some((option) => option.value === sortParam) ? (sortParam as SortKey) : "recent";
  const battery = positiveInt(params.get("battery"));
  return {
    sort,
    filters: {
      q: (params.get("q") ?? "").slice(0, 80),
      brands: list(params.get("brand")),
      models: list(params.get("model")),
      storages: list(params.get("storage"))
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isFinite(value) && value > 0),
      colours: list(params.get("colour")),
      conditions: list(params.get("condition")).filter((value): value is DeviceCondition =>
        CONDITIONS.includes(value as DeviceCondition),
      ),
      statuses: list(params.get("status")).filter((value): value is AvailabilityStatus =>
        STATUSES.includes(value as AvailabilityStatus),
      ),
      minBattery: battery !== null && battery >= 1 && battery <= 100 ? battery : null,
      priceMin: positiveInt(params.get("min")),
      priceMax: positiveInt(params.get("max")),
    },
  };
}

export function serialiseCatalogParams(filters: CatalogFilters, sort: SortKey): string {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.brands.length) params.set("brand", filters.brands.join(","));
  if (filters.models.length) params.set("model", filters.models.join(","));
  if (filters.storages.length) params.set("storage", filters.storages.join(","));
  if (filters.colours.length) params.set("colour", filters.colours.join(","));
  if (filters.conditions.length) params.set("condition", filters.conditions.join(","));
  if (filters.statuses.length) params.set("status", filters.statuses.join(","));
  if (filters.minBattery !== null) params.set("battery", String(filters.minBattery));
  if (filters.priceMin !== null) params.set("min", String(filters.priceMin));
  if (filters.priceMax !== null) params.set("max", String(filters.priceMax));
  if (sort !== "recent") params.set("sort", sort);
  return params.toString();
}

export function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}
