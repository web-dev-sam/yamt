export type CalendarDay = { readonly year: number; readonly month: number; readonly day: number };

const DAY_MS = 86_400_000;
const DAY_TEXT = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/u;
const YEAR_DIGITS = 4;
const PART_DIGITS = 2;
const DUE_FORMAT = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });

function utcMidnight({ year, month, day }: CalendarDay): Date {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date;
}

export function calendarDayFrom(text: string): CalendarDay | null {
  const parts = DAY_TEXT.exec(text)?.groups;
  if (parts === undefined) {
    return null;
  }
  const day = {
    year: Number(parts["year"]),
    month: Number(parts["month"]),
    day: Number(parts["day"]),
  };
  return utcMidnight(day).getUTCMonth() === day.month - 1 ? day : null;
}

export function calendarDayText({ year, month, day }: CalendarDay): string {
  const parts = [
    String(year).padStart(YEAR_DIGITS, "0"),
    String(month).padStart(PART_DIGITS, "0"),
    String(day).padStart(PART_DIGITS, "0"),
  ];
  return parts.join("-");
}

export function compareDays(a: CalendarDay, b: CalendarDay): number {
  return utcMidnight(a).getTime() - utcMidnight(b).getTime();
}

export function dueDateText(day: CalendarDay): string {
  return DUE_FORMAT.format(utcMidnight(day));
}

export function daysLeft(day: CalendarDay, now: number): number {
  const local = new Date(now);
  const today = { year: local.getFullYear(), month: local.getMonth() + 1, day: local.getDate() };
  return compareDays(day, today) / DAY_MS;
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
