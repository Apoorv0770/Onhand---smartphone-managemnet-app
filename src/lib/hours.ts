import { formatClock, istParts } from "@/lib/format";
import type { BusinessHours, DayHours, Weekday } from "@/lib/types";

const ORDER: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const SHORT: Record<Weekday, string> = {
  sun: "Sun",
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
};

export interface OpenStatus {
  isOpen: boolean;
  /** "Open now" or "Closed" */
  label: string;
  /** "Closes 9:00 PM", "Opens tomorrow 10:30 AM" or "" */
  detail: string;
}

function toMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function clock(value: string): string {
  const total = toMinutes(value);
  return formatClock(Math.floor(total / 60) % 24, total % 60);
}

function isUsable(day: DayHours | undefined): day is DayHours {
  return Boolean(day && !day.closed && day.open && day.close && day.open !== day.close);
}

/** Works out whether a shop is open right now, in India Standard Time. */
export function getOpenStatus(hours: BusinessHours | null, now: Date | number | string): OpenStatus | null {
  if (!hours) return null;
  const parts = istParts(now);
  const minutes = parts.hours * 60 + parts.minutes;
  const today = hours[ORDER[parts.weekday]];
  const yesterday = hours[ORDER[(parts.weekday + 6) % 7]];

  // Still inside yesterday's late-night session (for example 18:00 to 01:00).
  if (isUsable(yesterday)) {
    const open = toMinutes(yesterday.open);
    const close = toMinutes(yesterday.close);
    if (close < open && minutes < close) {
      return { isOpen: true, label: "Open now", detail: `Closes ${clock(yesterday.close)}` };
    }
  }

  if (isUsable(today)) {
    const open = toMinutes(today.open);
    const close = toMinutes(today.close);
    const overnight = close < open;
    if (minutes >= open && (overnight || minutes < close)) {
      return { isOpen: true, label: "Open now", detail: `Closes ${clock(today.close)}` };
    }
    if (minutes < open) {
      return { isOpen: false, label: "Closed", detail: `Opens ${clock(today.open)}` };
    }
  }

  for (let offset = 1; offset <= 7; offset++) {
    const id = ORDER[(parts.weekday + offset) % 7];
    const day = hours[id];
    if (isUsable(day)) {
      const when = offset === 1 ? "tomorrow" : SHORT[id];
      return { isOpen: false, label: "Closed", detail: `Opens ${when} ${clock(day.open)}` };
    }
  }

  return { isOpen: false, label: "Closed", detail: "" };
}

/** "10:30 AM – 9:00 PM" or "Closed" */
export function describeDay(day: DayHours): string {
  if (!isUsable(day)) return "Closed";
  return `${clock(day.open)} – ${clock(day.close)}`;
}
