# Slice mr-due-picker — yamt's own date picker for due dates, day-month-year everywhere

Owner's words (#2138, 2026-11-02): "the datepicker is horrible, make it a custom shadcn looking one, no american
format, always ddmmyyyy". Replaces the native `<input type="date">` of `ui/MergeRequestDueDate.vue` (request
`docs/slices/request-mr-row-details.md` rule 6: set, change, clear; stored per repository as today). Details marked
"(orchestrator)" are the orchestrator's choice; the owner may veto. Base: main `ead67588`.

## Target

Owned: `frontend/src/mergeRequests/internal/dueDate.ts`, `frontend/src/mergeRequests/internal/dueDate.test.ts`,
`frontend/src/mergeRequests/internal/calendar.ts` (new), `frontend/src/mergeRequests/internal/calendar.test.ts` (new),
`frontend/src/mergeRequests/index.ts`, `frontend/src/mergeRequests/AGENTS.md`, `frontend/src/ui/MergeRequestDueDate.vue`,
`frontend/src/ui/MergeRequestCalendar.vue` (new), `frontend/src/ui/mergeRequestsText.ts`,
`frontend/src/ui/mergeRequestsText.test.ts`, `frontend/src/ui/AGENTS.md`.

Read-only: everything else — `ui/mergeRequestDueDates.ts` (storage keeps `"YYYY-MM-DD"`: `calendarDayFrom` /
`calendarDayText` stay exactly as they are, they are the stored form, not a shown one), `style.css` (no new token:
the palette fence; use the existing ones as the other boxes do), `useHoverBox.ts` (`useScrollOutside` as is),
`useMenuPlacement.ts`, `tooltip.ts`, every other window, `docs/**` (put doc lines in `deviations_from_brief`).

Non-goals: a date-picker library or any new dependency (vision 5: Vue, @vueuse and Lucide cover it); date ranges;
times; a locale setting; another window's dates; changing how due dates are stored, ordered or dropped.

## Rules

1. **Format (orchestrator).** Every date the page shows is `DD.MM.YYYY` with leading zeros: `03.11.2026`. The row shows
   the date and under it the days left as today. The button's accessible name: "Due 03.11.2026, 1 day left. Change the
   due date". Typing accepts day first only: `3.11.2026`, `03.11.2026`, `03/11/2026`, `03-11-2026` and `03112026`
   (eight digits); a four-digit year always; anything else, or a day that does not exist (`31.02.2026`), is refused.
2. **Look (shadcn's Calendar in a Popover).** A box under the button like the page's other boxes (border, rounded,
   shadow, the panel colour): a text field on top (placeholder `DD.MM.YYYY`); a caption row with the month in words
   ("November 2026") between two ghost icon buttons (Lucide `chevron-left` / `chevron-right`, names "Previous month" /
   "Next month"); a row of weekday initials `Mo Tu We Th Fr Sa Su` (weeks start on Monday, orchestrator), muted and
   small; six rows of seven square, rounded day buttons. Days of the neighbouring months are shown muted and still
   pickable; today has the hover background and a medium weight; the chosen day is filled with the primary colour;
   hover gives the hover background. Footer: "Today" and, when a date is set, "Clear". Dark and light both readable.
3. **Mouse.** A click on a day saves it and closes the box; the chevrons change the month; "Today" saves today;
   "Clear" removes the date. A click outside or a scroll outside closes without saving (today's `onClickOutside` and
   `useScrollOutside`). Blur never saves (the native field's save-on-blur goes).
4. **Keyboard (WAI-ARIA date-picker dialog pattern).** Opening focuses the chosen day, else today, in the month shown.
   The grid has one tab stop (roving `tabindex`): arrows move one day / one week, Home/End to the week's Monday/Sunday,
   PageUp/PageDown one month, Shift+PageUp/PageDown one year (a day past the month's end clamps to its last day);
   moving past the shown month turns the month. Enter or Space saves the focused day. In the text field, Enter saves a
   valid typed date; a refused one marks the field invalid (`aria-invalid`, the error border) and saves nothing. Tab
   moves field → chevrons → grid → footer buttons. Escape closes and returns focus to the opener, as today.
5. **Roles.** The box `role="dialog"` named "Choose a due date"; the grid `role="grid"` labelled by the caption; each
   day a button whose name is the full date with weekday in words ("Tuesday, 3 November 2026"), `aria-selected` on the
   chosen one, `aria-current="date"` on today. No `title` attribute (the page's tooltip test stays green).

## Contract

Core (`frontend/src/mergeRequests`, framework-free, exported from `index.ts`; all `readonly`):

```ts
// dueDate.ts — existing exports keep their behaviour except dueDateText.
export function dueDateText(day: CalendarDay): string;            // "03.11.2026"; no Intl formatter
export function typedDay(text: string): CalendarDay | null;       // rule 1's typed forms, day first
export function localDay(now: number): CalendarDay;               // the local calendar day of `now` (daysLeft uses it)
// calendar.ts
export type CalendarMonth = { readonly year: number; readonly month: number }; // month 1–12
export type GridDay = { readonly day: CalendarDay; readonly inMonth: boolean };
export const WEEKDAYS: readonly string[];                         // ["Mo","Tu","We","Th","Fr","Sa","Su"]
export function monthGrid(month: CalendarMonth): readonly GridDay[]; // 42 days, from the Monday on or before the 1st
export function monthOf(day: CalendarDay): CalendarMonth;
export function addDays(day: CalendarDay, days: number): CalendarDay;
export function addMonths(day: CalendarDay, months: number): CalendarDay; // clamps to the target month's last day
export function sameDay(a: CalendarDay, b: CalendarDay): boolean;
export function monthCaption(month: CalendarMonth): string;       // "November 2026"
export function dayName(day: CalendarDay): string;                // "Tuesday, 3 November 2026"
```

Component: `MergeRequestCalendar.vue` props `{ selected: CalendarDay | null; today: CalendarDay }`, emits
`pick: [day: CalendarDay]`; it owns the shown month and the focused day; it is the grid, caption and chevrons only
(the field and footer stay in `MergeRequestDueDate.vue`). `MergeRequestDueDate.vue` keeps its props
`{ due, now }` and emit `set`.

## Acceptance

- `pnpm -C frontend test` (node), each named for the bug it catches, at least: `monthGrid` for a month starting on a
  Monday (no leading days), on a Sunday (six leading days), February 2028 (leap) and December → January (year turns);
  `addMonths` 31 January → 28/29 February, 31 March → 30 April, December + 1 → January of next year; `addDays` across
  month and year ends; `typedDay` each accepted form and refused `31.02.2026`, `2026-11-03`, `11/3/2026` read as day
  11 month 3 (day first, never American), `3.11.26`, `00.11.2026`; `dueDateText` `03.11.2026` and `01.01.0050`;
  `localDay` around local midnight (the existing Berlin stub); `dayName`, `monthCaption`; `dueDateLabel` with the new
  date. `lint`, `typecheck`, `fmt:check`, `sfc-order`, `unused` clean.
- WebKit fixture (`just app-session start-fixture --diff --mr list --size 1600x1000`), dark and light, screenshots of
  the open box in both: open the picker on !630, pick a day by click → the row reads `DD.MM.YYYY` over the days left and
  moves first; reopen, keyboard: arrows, PageDown, Enter → saved; type `05.12.2026` + Enter → saved; type
  `31.02.2026` + Enter → field invalid, nothing saved; chevrons turn the month; "Today" → "Due today"; reload keeps the
  date; "Clear" → back to the calendar icon and the newest-first place; Escape returns focus to the opener; a list
  scroll closes the box; no `input[type=date]` and no `[title]` on the page.
- `just mutants HEAD` (scope to your files' tests if its dry run stops on unrelated failures).

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://verification`.
