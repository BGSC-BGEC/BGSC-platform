/**
 * Small date formatters for event cards/detail (spec §4.2 "Sat, 14 Feb" style).
 * Hermes Intl is available on RN 0.85 (Expo SDK 56) — no date lib needed.
 */

const DAY_MONTH: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
};

export function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', DAY_MONTH);
}

/** "12 Feb – 20 Feb, 2026" — used on cards and the detail info block. */
export function formatEventRange(startIso: string, endIso: string): string {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const start = s.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const end = e.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${start} – ${end}`;
}

/** "12 Feb, 5:00 pm" — auction start, deadlines. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** "March 2024" — winner cards, legend achievement dates (hall-of-fame spec §6). */
export function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

/** "March 15, 2024" — winner detail sheet (hall-of-fame spec §9). */
export function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
