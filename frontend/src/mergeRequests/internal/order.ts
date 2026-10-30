import type { ListedRequest } from "./filters";

export function merged<R extends ListedRequest>(
  current: readonly R[],
  page: readonly R[],
): readonly R[] {
  const byIid = new Map<number, R>();
  for (const row of [...current, ...page]) {
    byIid.set(row.iid, row);
  }
  return [...byIid.values()].toSorted((a, b) =>
    a.createdAt === b.createdAt ? b.iid - a.iid : b.createdAt - a.createdAt,
  );
}
