export type CalendarDay = { readonly year: number; readonly month: number; readonly day: number };

const DAY_MS = 86_400_000;
const DAY_TEXT = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/u;
const TYPED_DAY =
  /^(?:(?<day>\d{1,2})(?<separator>[./-])(?<month>\d{1,2})\k<separator>(?<year>\d{4})|(?<dayDigits>\d{2})(?<monthDigits>\d{2})(?<yearDigits>\d{4}))$/u;
const YEAR_DIGITS = 4;
const PART_DIGITS = 2;

export function utcMidnight({ year, month, day }: CalendarDay): Date {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date;
}

function realDay(day: CalendarDay): CalendarDay | null {
  return utcMidnight(day).getUTCMonth() === day.month - 1 ? day : null;
}

export function calendarDayFrom(text: string): CalendarDay | null {
  const parts = DAY_TEXT.exec(text)?.groups;
  if (parts === undefined) {
    return null;
  }
  return realDay({
    year: Number(parts["year"]),
    month: Number(parts["month"]),
    day: Number(parts["day"]),
  });
}

export function typedDay(text: string): CalendarDay | null {
  const parts = TYPED_DAY.exec(text.trim())?.groups;
  if (parts === undefined) {
    return null;
  }
  return realDay({
    year: Number(parts["year"] ?? parts["yearDigits"]),
    month: Number(parts["month"] ?? parts["monthDigits"]),
    day: Number(parts["day"] ?? parts["dayDigits"]),
  });
}

function padded(part: number, digits: number): string {
  return String(part).padStart(digits, "0");
}

export function calendarDayText({ year, month, day }: CalendarDay): string {
  return [padded(year, YEAR_DIGITS), padded(month, PART_DIGITS), padded(day, PART_DIGITS)].join(
    "-",
  );
}

export function dueDateText({ year, month, day }: CalendarDay): string {
  return [padded(day, PART_DIGITS), padded(month, PART_DIGITS), padded(year, YEAR_DIGITS)].join(
    ".",
  );
}

export function compareDays(a: CalendarDay, b: CalendarDay): number {
  return (utcMidnight(a).getTime() - utcMidnight(b).getTime()) / DAY_MS;
}

export function localDay(now: number): CalendarDay {
  const local = new Date(now);
  return { year: local.getFullYear(), month: local.getMonth() + 1, day: local.getDate() };
}

function clockText(at: number): string {
  const local = new Date(at);
  return `${padded(local.getHours(), PART_DIGITS)}:${padded(local.getMinutes(), PART_DIGITS)}`;
}

export function dateTimeText(at: number): string {
  return `${dueDateText(localDay(at))}, ${clockText(at)}`;
}

export function timeTitle(at: number, now: number): string {
  return compareDays(localDay(at), localDay(now)) === 0 ? clockText(at) : dateTimeText(at);
}

export function daysLeft(day: CalendarDay, now: number): number {
  return compareDays(day, localDay(now));
}

export function daysLeftText(days: number): { readonly text: string; readonly overdue: boolean } {
  const count = Math.abs(days);
  const unit = count === 1 ? "day" : "days";
  if (days < 0) {
    return { text: `${count} ${unit} overdue`, overdue: true };
  }
  return days === 0
    ? { text: "Due today", overdue: false }
    : { text: `${count} ${unit} left`, overdue: false };
}
