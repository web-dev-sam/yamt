import { utcMidnight, type CalendarDay } from "./dueDate";

export type CalendarMonth = { readonly year: number; readonly month: number };
export type GridDay = { readonly day: CalendarDay; readonly inMonth: boolean };

export const WEEKDAYS: readonly string[] = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const GRID_WEEKS = 6;
export const MONTHS_PER_YEAR = 12;
const MONTH_NAME = new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" });
const WEEKDAY_NAME = new Intl.DateTimeFormat("en", { weekday: "long", timeZone: "UTC" });

function dayOf(date: Date): CalendarDay {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

export function weekdayIndex(day: CalendarDay): number {
  return (utcMidnight(day).getUTCDay() + WEEKDAYS.length - 1) % WEEKDAYS.length;
}

export function monthOf({ year, month }: CalendarDay): CalendarMonth {
  return { year, month };
}

export function addDays(day: CalendarDay, days: number): CalendarDay {
  const date = utcMidnight(day);
  date.setUTCDate(date.getUTCDate() + days);
  return dayOf(date);
}

export function addMonths({ year, month, day }: CalendarDay, months: number): CalendarDay {
  const index = year * MONTHS_PER_YEAR + month - 1 + months;
  const target = {
    year: Math.floor(index / MONTHS_PER_YEAR),
    month: (index % MONTHS_PER_YEAR) + 1,
  };
  const lastDay = utcMidnight({ ...target, month: target.month + 1, day: 0 }).getUTCDate();
  return { ...target, day: Math.min(day, lastDay) };
}

export function sameDay(a: CalendarDay, b: CalendarDay): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

export function monthGrid(month: CalendarMonth): readonly GridDay[] {
  const first = { ...month, day: 1 };
  const start = addDays(first, -weekdayIndex(first));
  return Array.from({ length: GRID_WEEKS * WEEKDAYS.length }, (_, offset) => {
    const day = addDays(start, offset);
    return { day, inMonth: day.month === month.month };
  });
}

export function monthCaption(month: CalendarMonth): string {
  return `${MONTH_NAME.format(utcMidnight({ ...month, day: 1 }))} ${month.year}`;
}

export function dayName(day: CalendarDay): string {
  const date = utcMidnight(day);
  return `${WEEKDAY_NAME.format(date)}, ${day.day} ${MONTH_NAME.format(date)} ${day.year}`;
}
