import { afterAll, expect, test, vi } from "vitest";

import {
  calendarDayFrom,
  calendarDayText,
  compareDays,
  daysLeft,
  daysLeftText,
  dueDateText,
  localDay,
  typedDay,
  type CalendarDay,
} from "../index";

vi.stubEnv("TZ", "Europe/Berlin");
afterAll(() => {
  vi.unstubAllEnvs();
});

const HOUR_MS = 3_600_000;

function day(text: string): CalendarDay {
  const parsed = calendarDayFrom(text);
  if (parsed === null) {
    throw new Error(`not a day: ${text}`);
  }
  return parsed;
}

function localTime(text: string, hours: number, minutes = 0, ms = 0): number {
  const { year, month, day: date } = day(text);
  return new Date(year, month - 1, date, hours, minutes, 0, ms).getTime();
}

function localDayHours(text: string): number {
  const { year, month, day: date } = day(text);
  return (
    (new Date(year, month - 1, date + 1).getTime() - new Date(year, month - 1, date).getTime()) /
    HOUR_MS
  );
}

test("days_left_changes_at_local_midnight", () => {
  const due = day("2026-11-09");
  expect(daysLeft(due, localTime("2026-11-08", 23, 59, 999))).toBe(1);
  expect(daysLeft(due, localTime("2026-11-09", 0))).toBe(0);
  expect(daysLeft(due, localTime("2026-11-09", 23, 59, 999))).toBe(0);
  expect(daysLeft(due, localTime("2026-11-10", 0))).toBe(-1);
  expect(daysLeft(due, localTime("2026-11-02", 12))).toBe(7);
});

test("days_left_across_month_and_year_ends", () => {
  expect(daysLeft(day("2026-02-01"), localTime("2026-01-31", 12))).toBe(1);
  expect(daysLeft(day("2026-03-01"), localTime("2026-02-28", 12))).toBe(1);
  expect(daysLeft(day("2028-03-01"), localTime("2028-02-28", 12))).toBe(2);
  expect(daysLeft(day("2028-03-01"), localTime("2028-02-29", 12))).toBe(1);
  expect(daysLeft(day("2027-01-01"), localTime("2026-12-31", 23, 59))).toBe(1);
  expect(daysLeft(day("2026-12-31"), localTime("2027-01-01", 0))).toBe(-1);
  expect(daysLeft(day("2027-11-09"), localTime("2026-11-09", 12))).toBe(365);
});

test("a_daylight_saving_day_counts_once", () => {
  expect(localDayHours("2026-03-29")).toBe(23);
  expect(localDayHours("2026-10-25")).toBe(25);
  expect(daysLeft(day("2026-03-30"), localTime("2026-03-28", 23, 30))).toBe(2);
  expect(daysLeft(day("2026-03-30"), localTime("2026-03-29", 23, 30))).toBe(1);
  expect(daysLeft(day("2026-03-30"), localTime("2026-03-30", 0, 30))).toBe(0);
  expect(daysLeft(day("2026-10-26"), localTime("2026-10-25", 0, 30))).toBe(1);
  expect(daysLeft(day("2026-10-26"), localTime("2026-10-25", 23, 30))).toBe(1);
  expect(daysLeft(day("2026-10-24"), localTime("2026-10-26", 0, 30))).toBe(-2);
});

test.each<[number, string, boolean]>([
  [0, "Due today", false],
  [1, "1 day left", false],
  [7, "7 days left", false],
  [-1, "1 day overdue", true],
  [-3, "3 days overdue", true],
])("daysLeftText(%i) reads %s", (days, text, overdue) => {
  expect(daysLeftText(days)).toEqual({ text, overdue });
});

test.each([
  "2026-02-30",
  "2026-02-29",
  "2026-13-01",
  "2026-00-10",
  "2026-01-00",
  "26-1-1",
  "",
  " 2026-01-01",
  "2026-01-01T00:00",
])("calendarDayFrom refuses %j", (text) => {
  expect(calendarDayFrom(text)).toBeNull();
});

test("calendarDayFrom reads a real day, a leap day included", () => {
  expect(calendarDayFrom("2026-11-09")).toEqual({ year: 2026, month: 11, day: 9 });
  expect(calendarDayFrom("2028-02-29")).toEqual({ year: 2028, month: 2, day: 29 });
  expect(calendarDayFrom("0050-12-31")).toEqual({ year: 50, month: 12, day: 31 });
});

test("calendarDayText writes the stored form with padded parts and reads back", () => {
  expect(calendarDayText({ year: 2026, month: 3, day: 5 })).toBe("2026-03-05");
  expect(calendarDayText({ year: 987, month: 12, day: 31 })).toBe("0987-12-31");
  expect(calendarDayFrom(calendarDayText(day("2026-11-09")))).toEqual(day("2026-11-09"));
});

test("compareDays counts the whole days between two days across months, years and leap days", () => {
  expect(compareDays(day("2026-12-31"), day("2027-01-01"))).toBe(-1);
  expect(compareDays(day("2027-01-01"), day("2026-12-31"))).toBe(1);
  expect(compareDays(day("2026-11-09"), day("2026-11-09"))).toBe(0);
  expect(compareDays(day("2026-03-01"), day("2026-01-31"))).toBe(29);
  expect(compareDays(day("2028-03-01"), day("2028-02-28"))).toBe(2);
});

test("dueDateText writes day, month, year with leading zeros, never the American order", () => {
  expect(dueDateText(day("2026-11-03"))).toBe("03.11.2026");
  expect(dueDateText(day("0050-01-01"))).toBe("01.01.0050");
  expect(dueDateText(day("2026-12-25"))).toBe("25.12.2026");
});

test.each<[string, CalendarDay]>([
  ["3.11.2026", { year: 2026, month: 11, day: 3 }],
  ["03.11.2026", { year: 2026, month: 11, day: 3 }],
  ["03/11/2026", { year: 2026, month: 11, day: 3 }],
  ["03-11-2026", { year: 2026, month: 11, day: 3 }],
  ["03112026", { year: 2026, month: 11, day: 3 }],
  ["11/3/2026", { year: 2026, month: 3, day: 11 }],
  ["29.02.2028", { year: 2028, month: 2, day: 29 }],
  [" 05.12.2026 ", { year: 2026, month: 12, day: 5 }],
])("typedDay reads %j day first", (text, expected) => {
  expect(typedDay(text)).toEqual(expected);
});

test.each([
  "31.02.2026",
  "29.02.2026",
  "2026-11-03",
  "3.11.26",
  "00.11.2026",
  "03.00.2026",
  "03.13.2026",
  "03.11-2026",
  "3112026",
  "031120266",
  "003.11.2026",
  "03.011.2026",
  "03 11 2026",
  "a03.11.2026",
  "03.11.2026a",
  "",
])("typedDay refuses %j", (text) => {
  expect(typedDay(text)).toBeNull();
});

test("localDay is the calendar day of the local clock, turning at local midnight", () => {
  expect(localDay(localTime("2026-11-08", 23, 59, 999))).toEqual(day("2026-11-08"));
  expect(localDay(localTime("2026-11-09", 0))).toEqual(day("2026-11-09"));
  expect(localDay(localTime("2026-12-31", 23, 59))).toEqual(day("2026-12-31"));
  expect(localDay(localTime("2027-01-01", 0))).toEqual(day("2027-01-01"));
  expect(localDay(Date.UTC(2026, 10, 8, 23, 30))).toEqual(day("2026-11-09"));
});
