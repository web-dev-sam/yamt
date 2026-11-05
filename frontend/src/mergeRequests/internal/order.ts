import { compareDays, type CalendarDay } from "./dueDate";
import type { ListedRequest } from "./filters";

type Created = { readonly iid: number; readonly createdAt: number };

function newestFirst(a: Created, b: Created): number {
  return a.createdAt === b.createdAt ? b.iid - a.iid : b.createdAt - a.createdAt;
}

export function merged<R extends ListedRequest>(
  current: readonly R[],
  page: readonly R[],
): readonly R[] {
  const byIid = new Map<number, R>();
  for (const row of [...current, ...page]) {
    byIid.set(row.iid, row);
  }
  return [...byIid.values()].toSorted(newestFirst);
}

/** Plan §2 row 156: a dated row before an undated one, the soonest day first; 0 for two undated rows or the same day. */
export function dueFirst(a: CalendarDay | null, b: CalendarDay | null): number {
  if (a === null || b === null) {
    return Number(a === null) - Number(b === null);
  }
  return compareDays(a, b);
}

export function byDueDate<R extends Created>(
  rows: readonly R[],
  dueOf: (iid: number) => CalendarDay | null,
): readonly R[] {
  return rows
    .map((row) => ({ row, due: dueOf(row.iid) }))
    .toSorted((a, b) => {
      const days = dueFirst(a.due, b.due);
      return days === 0 && a.due !== null ? newestFirst(a.row, b.row) : days;
    })
    .map(({ row }) => row);
}
