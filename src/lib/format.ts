/* ---------------------------------------------------------------------------
   Deterministic formatters.
   Hand-rolled instead of Intl so server and browser always render identical
   strings (no hydration drift between ICU versions), in India Standard Time.
--------------------------------------------------------------------------- */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type DateInput = string | number | Date;

export interface IstParts {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  /** 0 = Sunday */
  weekday: number;
}

export function istParts(input: DateInput): IstParts {
  const shifted = new Date(new Date(input).getTime() + IST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** YYYY-MM-DD for the given instant, in IST. */
export function istDay(input: DateInput): string {
  const parts = istParts(input);
  return `${parts.year}-${pad(parts.month + 1)}-${pad(parts.day)}`;
}

/** Converts a YYYY-MM-DD day (IST) to an ISO instant at local noon. */
export function istDayToIso(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date, 12, 0, 0) - IST_OFFSET_MS).toISOString();
}

/** "12 Nov 2026" */
export function formatDate(input: DateInput): string {
  const parts = istParts(input);
  return `${parts.day} ${MONTHS[parts.month]} ${parts.year}`;
}

/** "12 Nov" */
export function formatShortDate(input: DateInput): string {
  const parts = istParts(input);
  return `${parts.day} ${MONTHS[parts.month]}`;
}

/** "Thu, 12 Nov" */
export function formatWeekdayDate(input: DateInput): string {
  const parts = istParts(input);
  return `${WEEKDAYS_SHORT[parts.weekday]}, ${parts.day} ${MONTHS[parts.month]}`;
}

/** "9:05 PM" */
export function formatTime(input: DateInput): string {
  const parts = istParts(input);
  return formatClock(parts.hours, parts.minutes);
}

export function formatClock(hours: number, minutes: number): string {
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${pad(minutes)} ${suffix}`;
}

/** "2 hours ago", "Yesterday", "12 Nov". */
export function formatRelative(input: DateInput, now: DateInput): string {
  const then = new Date(input).getTime();
  const diff = new Date(now).getTime() - then;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < 45 * 1000) return "Just now";
  if (diff < hour) {
    const minutes = Math.max(1, Math.round(diff / minute));
    return `${minutes} min ago`;
  }
  if (diff < day) {
    const hours = Math.round(diff / hour);
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }
  if (diff < 2 * day) return "Yesterday";
  if (diff < 7 * day) return `${Math.floor(diff / day)} days ago`;
  const thenParts = istParts(input);
  const nowParts = istParts(now);
  return thenParts.year === nowParts.year ? formatShortDate(input) : formatDate(input);
}

/** Indian digit grouping: 1234567 -> "12,34,567". */
export function formatIndianNumber(value: number): string {
  const negative = value < 0;
  const digits = String(Math.round(Math.abs(value)));
  if (digits.length <= 3) return (negative ? "-" : "") + digits;
  const lastThree = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${rest},${lastThree}`;
}

/** "₹54,999" */
export function formatPrice(value: number): string {
  return `₹${formatIndianNumber(value)}`;
}

/** "128 GB", "1 TB" */
export function formatStorage(gb: number): string {
  if (gb >= 1024 && gb % 1024 === 0) return `${gb / 1024} TB`;
  return `${gb} GB`;
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** 919876543210 -> "+91 98765 43210" */
export function formatPhone(digits: string): string {
  const clean = digits.replace(/\D/g, "");
  if (clean.length === 12 && clean.startsWith("91")) {
    return `+91 ${clean.slice(2, 7)} ${clean.slice(7)}`;
  }
  if (clean.length === 10) return `${clean.slice(0, 5)} ${clean.slice(5)}`;
  return clean ? `+${clean}` : "";
}

/** Local 10 digit part of an Indian number for editing in a "+91" field. */
export function localPhonePart(digits: string | null | undefined): string {
  if (!digits) return "";
  const clean = digits.replace(/\D/g, "");
  return clean.length === 12 && clean.startsWith("91") ? clean.slice(2) : clean;
}
