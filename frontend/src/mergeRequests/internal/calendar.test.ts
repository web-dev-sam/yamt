import { afterAll, expect, test, vi } from "vitest";

import {
  WEEKDAYS,
  addDays,
  addMonths,
  calendarDayFrom,
  calendarDayText,
  dayName,
  monthCaption,
  monthGrid,
  monthOf,
  sameDay,
  weekdayIndex,
  type CalendarDay,
  type GridDay,
} from "../index";

vi.stubEnv("TZ", "Europe/Berlin");
afterAll(() => {
  vi.unstubAllEnvs();
});

function day(text: string): CalendarDay {
  const parsed = calendarDayFrom(text);
  if (parsed === null) {
    throw new Error(`not a day: ${text}`);
  }
  return parsed;
}

function gridText(grid: readonly GridDay[]): readonly string[] {
  return grid.map(({ day: shown, inMonth }) => `${calendarDayText(shown)}${inMonth ? "" : "*"}`);
}

test("the weekdays start on Monday", () => {
  expect(WEEKDAYS).toEqual(["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]);
});

test("a month starting on a Monday has no leading days", () => {
  const grid = gridText(monthGrid({ year: 2026, month: 6 }));
  expect(grid).toHaveLength(42);
  expect(grid[0]).toBe("2026-06-01");
  expect(grid[29]).toBe("2026-06-30");
  expect(grid.slice(30)).toEqual([
    "2026-07-01*",
    "2026-07-02*",
    "2026-07-03*",
    "2026-07-04*",
    "2026-07-05*",
    "2026-07-06*",
    "2026-07-07*",
    "2026-07-08*",
    "2026-07-09*",
    "2026-07-10*",
    "2026-07-11*",
    "2026-07-12*",
  ]);
});

test("a month starting on a Sunday has six leading days of the month before", () => {
  const grid = gridText(monthGrid({ year: 2026, month: 11 }));
  expect(grid).toHaveLength(42);
  expect(grid.slice(0, 7)).toEqual([
    "2026-10-26*",
    "2026-10-27*",
    "2026-10-28*",
    "2026-10-29*",
    "2026-10-30*",
    "2026-10-31*",
    "2026-11-01",
  ]);
  expect(grid[35]).toBe("2026-11-30");
  expect(grid[36]).toBe("2026-12-01*");
  expect(grid[41]).toBe("2026-12-06*");
});

test("February of a leap year shows its 29th day", () => {
  const grid = gridText(monthGrid({ year: 2028, month: 2 }));
  expect(grid[0]).toBe("2028-01-31*");
  expect(grid[1]).toBe("2028-02-01");
  expect(grid[29]).toBe("2028-02-29");
  expect(grid[30]).toBe("2028-03-01*");
  expect(grid.filter((shown) => !shown.endsWith("*"))).toHaveLength(29);
});

test("December's grid turns into January of the next year", () => {
  const grid = gridText(monthGrid({ year: 2026, month: 12 }));
  expect(grid[0]).toBe("2026-11-30*");
  expect(grid[1]).toBe("2026-12-01");
  expect(grid[31]).toBe("2026-12-31");
  expect(grid[32]).toBe("2027-01-01*");
  expect(grid[41]).toBe("2027-01-10*");
});

test("January's grid starts in December of the year before", () => {
  const grid = gridText(monthGrid({ year: 2027, month: 1 }));
  expect(grid.slice(0, 5)).toEqual([
    "2026-12-28*",
    "2026-12-29*",
    "2026-12-30*",
    "2026-12-31*",
    "2027-01-01",
  ]);
});

test("addMonths clamps to the last day of a shorter month", () => {
  expect(addMonths(day("2026-01-31"), 1)).toEqual(day("2026-02-28"));
  expect(addMonths(day("2028-01-31"), 1)).toEqual(day("2028-02-29"));
  expect(addMonths(day("2026-03-31"), 1)).toEqual(day("2026-04-30"));
  expect(addMonths(day("2026-03-31"), -1)).toEqual(day("2026-02-28"));
  expect(addMonths(day("2026-04-15"), 1)).toEqual(day("2026-05-15"));
});

test("addMonths turns the year both ways", () => {
  expect(addMonths(day("2026-12-15"), 1)).toEqual(day("2027-01-15"));
  expect(addMonths(day("2027-01-31"), -1)).toEqual(day("2026-12-31"));
  expect(addMonths(day("2028-02-29"), 12)).toEqual(day("2029-02-28"));
  expect(addMonths(day("2028-02-29"), -12)).toEqual(day("2027-02-28"));
  expect(addMonths(day("2026-11-03"), 14)).toEqual(day("2028-01-03"));
});

test("addDays crosses month and year ends", () => {
  expect(addDays(day("2026-01-31"), 1)).toEqual(day("2026-02-01"));
  expect(addDays(day("2026-03-01"), -1)).toEqual(day("2026-02-28"));
  expect(addDays(day("2028-03-01"), -1)).toEqual(day("2028-02-29"));
  expect(addDays(day("2026-12-31"), 1)).toEqual(day("2027-01-01"));
  expect(addDays(day("2027-01-01"), -7)).toEqual(day("2026-12-25"));
  expect(addDays(day("2026-03-28"), 2)).toEqual(day("2026-03-30"));
});

test("weekdayIndex counts from Monday", () => {
  expect(weekdayIndex(day("2026-11-02"))).toBe(0);
  expect(weekdayIndex(day("2026-11-03"))).toBe(1);
  expect(weekdayIndex(day("2026-11-08"))).toBe(6);
});

test("sameDay compares year, month and day", () => {
  expect(sameDay(day("2026-11-03"), day("2026-11-03"))).toBe(true);
  expect(sameDay(day("2026-11-03"), day("2027-11-03"))).toBe(false);
  expect(sameDay(day("2026-11-03"), day("2026-10-03"))).toBe(false);
  expect(sameDay(day("2026-11-03"), day("2026-11-04"))).toBe(false);
});

test("monthOf drops the day", () => {
  expect(monthOf(day("2026-11-03"))).toEqual({ year: 2026, month: 11 });
});

test("the caption and the day names are English words read in UTC", async () => {
  expect(monthCaption({ year: 2026, month: 11 })).toBe("November 2026");
  expect(monthCaption({ year: 2027, month: 1 })).toBe("January 2027");
  expect(dayName(day("2026-11-03"))).toBe("Tuesday, 3 November 2026");
  expect(dayName(day("2027-01-01"))).toBe("Friday, 1 January 2027");
  vi.stubEnv("TZ", "America/Los_Angeles");
  vi.resetModules();
  // The formatters take the process zone when the module loads, so it loads again west of UTC.
  const west = await import("../index");
  vi.stubEnv("TZ", "Europe/Berlin");
  expect(west.monthCaption({ year: 2026, month: 11 })).toBe("November 2026");
  expect(west.dayName(day("2026-11-01"))).toBe("Sunday, 1 November 2026");
});
