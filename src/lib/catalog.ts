import type {
  AvailabilityStatus,
  BusinessHours,
  CoverStyleId,
  DeviceCondition,
  Weekday,
} from "@/lib/types";

/* ---------------------------------------------------------------------------
   Reference data: brands, model suggestions, colours, conditions.
   Suggestions only speed up typing. Retailers can always enter their own.
--------------------------------------------------------------------------- */

export const BRANDS = [
  "Apple",
  "Samsung",
  "Google",
  "OnePlus",
  "Xiaomi",
  "Nothing",
  "Realme",
  "Vivo",
  "OPPO",
  "Motorola",
  "iQOO",
  "POCO",
] as const;

export const MODEL_SUGGESTIONS: Record<string, string[]> = {
  Apple: [
    "iPhone 16 Pro Max",
    "iPhone 16 Pro",
    "iPhone 16 Plus",
    "iPhone 16",
    "iPhone 15 Pro Max",
    "iPhone 15 Pro",
    "iPhone 15 Plus",
    "iPhone 15",
    "iPhone 14 Pro Max",
    "iPhone 14 Pro",
    "iPhone 14 Plus",
    "iPhone 14",
    "iPhone 13 Pro Max",
    "iPhone 13 Pro",
    "iPhone 13",
    "iPhone 13 Mini",
    "iPhone 12 Pro Max",
    "iPhone 12 Pro",
    "iPhone 12",
    "iPhone 12 Mini",
    "iPhone 11 Pro Max",
    "iPhone 11 Pro",
    "iPhone 11",
    "iPhone SE (2022)",
    "iPhone XR",
  ],
  Samsung: [
    "Galaxy S24 Ultra",
    "Galaxy S24+",
    "Galaxy S24",
    "Galaxy S23 Ultra",
    "Galaxy S23+",
    "Galaxy S23",
    "Galaxy S23 FE",
    "Galaxy S22 Ultra",
    "Galaxy S22",
    "Galaxy S21 FE",
    "Galaxy Z Fold 5",
    "Galaxy Z Flip 5",
    "Galaxy A55",
    "Galaxy A54",
    "Galaxy M34",
  ],
  Google: [
    "Pixel 9 Pro",
    "Pixel 9",
    "Pixel 8 Pro",
    "Pixel 8",
    "Pixel 8a",
    "Pixel 7 Pro",
    "Pixel 7",
    "Pixel 7a",
    "Pixel 6a",
  ],
  OnePlus: [
    "OnePlus 12",
    "OnePlus 12R",
    "OnePlus 11",
    "OnePlus 11R",
    "OnePlus 10 Pro",
    "OnePlus Nord 3",
    "OnePlus Nord CE 3",
  ],
  Xiaomi: ["Xiaomi 14", "Xiaomi 13 Pro", "Redmi Note 13 Pro+", "Redmi Note 13 Pro", "Redmi Note 12 Pro"],
  Nothing: ["Phone (2)", "Phone (2a)", "Phone (1)"],
  Realme: ["Realme GT 6", "Realme 12 Pro+", "Realme 11 Pro"],
  Vivo: ["Vivo X100", "Vivo V30 Pro", "Vivo V29"],
  OPPO: ["OPPO Reno 11 Pro", "OPPO Reno 10 Pro", "OPPO F25 Pro"],
  Motorola: ["Motorola Edge 50 Pro", "Motorola Edge 40", "Moto G84"],
  iQOO: ["iQOO 12", "iQOO Neo 9 Pro", "iQOO 11"],
  POCO: ["POCO F6", "POCO F5", "POCO X6 Pro"],
};

export const STORAGE_OPTIONS = [64, 128, 256, 512, 1024] as const;

export const COLOUR_SUGGESTIONS: Record<string, string[]> = {
  Apple: [
    "Midnight",
    "Starlight",
    "Blue",
    "Black",
    "White",
    "Deep Purple",
    "Purple",
    "Pink",
    "Green",
    "Yellow",
    "Gold",
    "Silver",
    "Space Black",
    "Graphite",
    "Sierra Blue",
    "Pacific Blue",
    "Alpine Green",
    "Natural Titanium",
    "Blue Titanium",
    "White Titanium",
    "Black Titanium",
    "Desert Titanium",
    "Red",
  ],
  Samsung: [
    "Phantom Black",
    "Phantom White",
    "Green",
    "Cream",
    "Lavender",
    "Burgundy",
    "Onyx Black",
    "Marble Grey",
    "Cobalt Violet",
    "Amber Yellow",
    "Titanium Grey",
    "Titanium Black",
    "Mint",
    "Graphite",
  ],
  Google: ["Obsidian", "Snow", "Hazel", "Lemongrass", "Bay", "Porcelain", "Rose", "Stormy Black", "Sorta Seafoam"],
  OnePlus: ["Titan Black", "Eternal Green", "Silky Black", "Flowy Emerald", "Cool Blue", "Iron Grey", "Misty Green"],
  Nothing: ["White", "Dark Grey", "Black", "Milk"],
};

const GENERIC_COLOURS = ["Black", "White", "Blue", "Green", "Silver", "Gold", "Grey", "Purple", "Red"];

export function colourSuggestionsFor(brand: string): string[] {
  return COLOUR_SUGGESTIONS[brand] ?? GENERIC_COLOURS;
}

/**
 * Approximate finish colours for the device illustrations.
 * These tint a drawing. They are not a claim about the exact shade of a unit.
 */
const COLOUR_HEX: Record<string, string> = {
  // Apple
  midnight: "#2b3038",
  starlight: "#efe7da",
  "deep purple": "#5a4f66",
  purple: "#b9a9d6",
  pink: "#eccfd4",
  yellow: "#f2e3a0",
  "sierra blue": "#a5bcd4",
  "pacific blue": "#33566a",
  "alpine green": "#55664f",
  "space black": "#3b3a3a",
  "space grey": "#55565a",
  "space gray": "#55565a",
  graphite: "#55534f",
  "natural titanium": "#aaa398",
  "blue titanium": "#3f4a5c",
  "white titanium": "#eceae4",
  "black titanium": "#3d3d3f",
  "desert titanium": "#c7ab8f",
  "product red": "#b8232f",
  // Samsung
  "phantom black": "#2a2b2e",
  "phantom white": "#eeeeec",
  cream: "#efe6d2",
  lavender: "#d5c8e3",
  burgundy: "#6d2e3d",
  "onyx black": "#2c2d30",
  "marble grey": "#c5c6c8",
  "marble gray": "#c5c6c8",
  "cobalt violet": "#4e4a78",
  "amber yellow": "#ecd98e",
  "titanium grey": "#8c8a86",
  "titanium gray": "#8c8a86",
  "titanium black": "#38383a",
  mint: "#cfe5d8",
  // Google
  obsidian: "#2c2d30",
  snow: "#f1eee8",
  hazel: "#7d8475",
  lemongrass: "#e3e6ae",
  bay: "#a9c4e6",
  porcelain: "#ede4d6",
  rose: "#edc9c0",
  "stormy black": "#2e2f31",
  "sorta seafoam": "#c8dcd2",
  // OnePlus and others
  "titan black": "#232426",
  "eternal green": "#2f5a4b",
  "silky black": "#1f2022",
  "flowy emerald": "#3f7a67",
  "cool blue": "#9db9d6",
  "iron grey": "#5f6266",
  "iron gray": "#5f6266",
  "misty green": "#b9d3c4",
  "dark grey": "#4a4b4e",
  "dark gray": "#4a4b4e",
  milk: "#f2efe9",
  "midnight black": "#232528",
  // Generic
  black: "#26272a",
  white: "#f1f0ec",
  blue: "#b5cbdc",
  green: "#c4d2bd",
  red: "#b8232f",
  silver: "#dcdddd",
  gold: "#ead9bb",
  grey: "#8d8f93",
  gray: "#8d8f93",
  orange: "#e2783c",
  teal: "#4f8a8b",
  violet: "#8f7fc0",
  titanium: "#aaa398",
};

const KEYWORD_ORDER = [
  "black",
  "white",
  "blue",
  "green",
  "red",
  "purple",
  "violet",
  "pink",
  "yellow",
  "gold",
  "silver",
  "grey",
  "gray",
  "orange",
  "teal",
  "titanium",
  "graphite",
  "cream",
  "mint",
];

/** Colour for an illustration plus whether a real match was found. */
export function colourToHex(colour: string, brand?: string): string {
  const key = colour.trim().toLowerCase().replace(/\s+/g, " ");
  if (!key) return "#8d8f93";
  if (brand === "Samsung" && key === "green") return "#3f4b42";
  if (brand === "Google" && key === "green") return "#c8dcd2";
  if (COLOUR_HEX[key]) return COLOUR_HEX[key];
  const stripped = key.replace(/\(.*?\)/g, "").trim();
  if (COLOUR_HEX[stripped]) return COLOUR_HEX[stripped];
  for (const word of KEYWORD_ORDER) {
    if (key.includes(word)) return COLOUR_HEX[word];
  }
  return "#8d8f93";
}

/* -------------------------------- Conditions ------------------------------- */

export const CONDITIONS: {
  id: DeviceCondition;
  label: string;
  description: string;
}[] = [
  { id: "like_new", label: "Like new", description: "No visible marks on the screen or body." },
  { id: "excellent", label: "Excellent", description: "Faint signs of use, only visible up close." },
  { id: "good", label: "Good", description: "Light scratches or scuffs from normal use." },
  { id: "fair", label: "Fair", description: "Clearly visible wear such as scratches or small dents." },
];

export const CONDITION_LABEL: Record<DeviceCondition, string> = {
  like_new: "Like new",
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
};

export const CONDITION_RANK: Record<DeviceCondition, number> = {
  like_new: 0,
  excellent: 1,
  good: 2,
  fair: 3,
};

export const CONDITION_DESCRIPTION: Record<DeviceCondition, string> = Object.fromEntries(
  CONDITIONS.map((condition) => [condition.id, condition.description]),
) as Record<DeviceCondition, string>;

/* ------------------------------- Availability ------------------------------ */

export const AVAILABILITY: { id: AvailabilityStatus; label: string; description: string }[] = [
  { id: "available", label: "Available", description: "In stock and ready to sell." },
  { id: "reserved", label: "Reserved", description: "On hold for a customer." },
  { id: "sold", label: "Sold", description: "No longer in stock." },
];

export const AVAILABILITY_LABEL: Record<AvailabilityStatus, string> = {
  available: "Available",
  reserved: "Reserved",
  sold: "Sold",
};

export const AVAILABILITY_RANK: Record<AvailabilityStatus, number> = {
  available: 0,
  reserved: 1,
  sold: 2,
};

/* ------------------------------ Form shortcuts ----------------------------- */

export const ACCESSORY_OPTIONS = [
  "Original box",
  "Charger",
  "Charging cable",
  "Earphones",
  "Case",
  "Screen protector",
  "Original bill",
];

export const WARRANTY_PRESETS = [
  "No warranty",
  "7-day shop warranty",
  "30-day shop warranty",
  "3-month shop warranty",
  "Brand warranty active",
];

/** Brands whose phones report a battery health percentage in settings. */
export function reportsBatteryHealth(brand: string): boolean {
  return brand.trim().toLowerCase() === "apple";
}

/* ------------------------------ Business hours ----------------------------- */

export const WEEKDAYS: { id: Weekday; label: string; short: string }[] = [
  { id: "mon", label: "Monday", short: "Mon" },
  { id: "tue", label: "Tuesday", short: "Tue" },
  { id: "wed", label: "Wednesday", short: "Wed" },
  { id: "thu", label: "Thursday", short: "Thu" },
  { id: "fri", label: "Friday", short: "Fri" },
  { id: "sat", label: "Saturday", short: "Sat" },
  { id: "sun", label: "Sunday", short: "Sun" },
];

export function defaultHours(): BusinessHours {
  const day = { closed: false, open: "10:30", close: "21:00" };
  return {
    mon: { ...day },
    tue: { ...day },
    wed: { ...day },
    thu: { ...day },
    fri: { ...day },
    sat: { ...day },
    sun: { closed: true, open: "10:30", close: "21:00" },
  };
}

/* ------------------------------- Cover styles ------------------------------ */

export interface CoverStyle {
  id: CoverStyleId;
  name: string;
  tone: "dark" | "light";
  /** CSS background for the storefront header. */
  background: string;
  /** Solid swatch shown in pickers. */
  swatch: string;
}

export const COVER_STYLES: CoverStyle[] = [
  {
    id: "graphite",
    name: "Graphite",
    tone: "dark",
    swatch: "#232220",
    background:
      "radial-gradient(120% 140% at 85% -20%, #4a4640 0%, transparent 55%), radial-gradient(90% 120% at 0% 110%, #3a2a22 0%, transparent 60%), linear-gradient(160deg, #262523 0%, #171615 100%)",
  },
  {
    id: "paper",
    name: "Paper",
    tone: "light",
    swatch: "#efeae2",
    background:
      "radial-gradient(110% 130% at 90% -10%, #ffffff 0%, transparent 55%), radial-gradient(90% 120% at 0% 110%, #e4dccf 0%, transparent 60%), linear-gradient(160deg, #f4f0e9 0%, #ebe5da 100%)",
  },
  {
    id: "ember",
    name: "Ember",
    tone: "dark",
    swatch: "#b5471f",
    background:
      "radial-gradient(110% 140% at 88% -20%, #f08a4f 0%, transparent 55%), radial-gradient(90% 120% at 0% 110%, #6e1f14 0%, transparent 62%), linear-gradient(160deg, #c2501f 0%, #8a2c16 100%)",
  },
  {
    id: "lagoon",
    name: "Lagoon",
    tone: "dark",
    swatch: "#17555c",
    background:
      "radial-gradient(110% 140% at 88% -20%, #3f9b9a 0%, transparent 55%), radial-gradient(90% 120% at 0% 110%, #0d2f3a 0%, transparent 62%), linear-gradient(160deg, #1b5f66 0%, #103c47 100%)",
  },
  {
    id: "moss",
    name: "Moss",
    tone: "dark",
    swatch: "#34492f",
    background:
      "radial-gradient(110% 140% at 88% -20%, #7b9a62 0%, transparent 55%), radial-gradient(90% 120% at 0% 110%, #1b2a1c 0%, transparent 62%), linear-gradient(160deg, #3c5435 0%, #233423 100%)",
  },
  {
    id: "dusk",
    name: "Dusk",
    tone: "dark",
    swatch: "#2a3350",
    background:
      "radial-gradient(110% 140% at 88% -20%, #6f7fb8 0%, transparent 55%), radial-gradient(90% 120% at 0% 110%, #3b2238 0%, transparent 62%), linear-gradient(160deg, #2f3a5c 0%, #1c2138 100%)",
  },
];

export function coverStyle(id: CoverStyleId | string | null | undefined): CoverStyle {
  return COVER_STYLES.find((style) => style.id === id) ?? COVER_STYLES[0];
}

export const COVER_STYLE_IDS = COVER_STYLES.map((style) => style.id) as [CoverStyleId, ...CoverStyleId[]];
