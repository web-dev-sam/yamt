const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const WEEK_MS = 604_800_000;
const MONTH_30_DAYS_MS = 2_592_000_000;
const YEAR_365_DAYS_MS = 31_536_000_000;
const UNITS: readonly (readonly [Intl.RelativeTimeFormatUnit, number])[] = [
  ["year", YEAR_365_DAYS_MS],
  ["month", MONTH_30_DAYS_MS],
  ["week", WEEK_MS],
  ["day", DAY_MS],
  ["hour", HOUR_MS],
  ["minute", MINUTE_MS],
];
const FORMAT = new Intl.RelativeTimeFormat("en", { numeric: "always" });

export function createdAgo(createdAt: number, now: number): string {
  const age = now - createdAt;
  const unit = UNITS.find(([, size]) => age >= size);
  return unit === undefined
    ? "created just now"
    : `created ${FORMAT.format(-Math.floor(age / unit[1]), unit[0])}`;
}
