import { expect, test } from "vitest";

import { byDueDate, calendarDayFrom, merged, type CalendarDay, type ListedRequest } from "../index";

type Row = ListedRequest & { readonly title: string };

function row(iid: number, createdAt: number, title = `!${iid}`): Row {
  return { iid, createdAt, title, draft: false, assignees: [], reviewers: [], labels: [] };
}

test("rows come newest created first, a tie ordered by the higher iid first", () => {
  const page = [row(9, 100), row(3, 300), row(4, 200), row(7, 200), row(5, 200)];
  expect(merged([], page).map((listed) => listed.iid)).toEqual([3, 7, 5, 4, 9]);
});

test("a page's rows join the current ones in order", () => {
  const current = [row(9, 300), row(4, 100)];
  const page = [row(6, 200), row(2, 50)];
  expect(merged(current, page).map((listed) => listed.iid)).toEqual([9, 6, 4, 2]);
});

test("a row in both appears once, the page's copy kept", () => {
  const current = [row(9, 300, "old title"), row(4, 100)];
  const page = [row(9, 300, "new title"), row(2, 50)];
  const rows = merged(current, page);
  expect(rows.map((listed) => listed.iid)).toEqual([9, 4, 2]);
  expect(rows[0]?.title).toBe("new title");
});

function dueDays(days: Readonly<Record<number, string>>): (iid: number) => CalendarDay | null {
  return (iid) => calendarDayFrom(days[iid] ?? "");
}

test("dated_rows_come_first_soonest_on_top_overdue_first", () => {
  const rows = [row(9, 900), row(8, 800), row(7, 700), row(6, 600), row(5, 500)];
  const due = dueDays({ 8: "2026-12-01", 6: "2026-10-30", 5: "2026-11-09" });
  expect(byDueDate(rows, due).map((listed) => listed.iid)).toEqual([6, 5, 8, 9, 7]);
});

test("equal_days_newest_first", () => {
  const rows = [row(3, 100), row(4, 300), row(2, 300), row(1, 200)];
  const due = dueDays({ 1: "2026-11-09", 2: "2026-11-09", 3: "2026-11-09", 4: "2026-11-09" });
  expect(byDueDate(rows, due).map((listed) => listed.iid)).toEqual([4, 2, 1, 3]);
});

test("undated_rows_keep_their_order", () => {
  const rows = [row(1, 100), row(2, 300), row(3, 200), row(4, 50)];
  const due = dueDays({ 3: "2027-01-01" });
  expect(byDueDate(rows, due).map((listed) => listed.iid)).toEqual([3, 1, 2, 4]);
  expect(byDueDate(rows, dueDays({}))).toEqual(rows);
});
