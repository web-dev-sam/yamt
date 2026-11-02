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

export function byDueDate<R extends Created>(
  rows: readonly R[],
  dueOf: (iid: number) => CalendarDay | null,
): readonly R[] {
  const dated: { readonly row: R; readonly due: CalendarDay }[] = [];
  const undated: R[] = [];
  for (const row of rows) {
    const due = dueOf(row.iid);
    if (due === null) {
      undated.push(row);
    } else {
      dated.push({ row, due });
    }
  }
  const soonestFirst = dated.toSorted((a, b) => {
    const days = compareDays(a.due, b.due);
    return days === 0 ? newestFirst(a.row, b.row) : days;
  });
  return [...soonestFirst.map(({ row }) => row), ...undated];
}
