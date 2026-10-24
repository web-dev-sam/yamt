import { shownColumn, type Column, type Difference, type ThreadLine } from "../../ipc";
import { linePlace } from "./threadAnchor";

export type ShownThread = {
  readonly key: string;
  readonly line: ThreadLine;
  readonly shown: "open" | "collapsed" | "draft";
};

type ThreadPlace = Readonly<Record<Column, number>>;

export type ThreadRow = {
  readonly key: string;
  readonly place: ThreadPlace;
  readonly keys: Readonly<Record<Column, readonly string[]>>;
  readonly unchanged: boolean;
};

type GrowingRow = Omit<ThreadRow, "keys"> & { readonly keys: Record<Column, string[]> };

function gapAfter(differences: readonly Difference[], column: Column, line: number): number {
  const place = linePlace(differences, column, line);
  if (place.kind === "between") {
    return place.partner + 1;
  }
  const other = column === "left" ? place.difference.right : place.difference.left;
  return other.start + other.len;
}

function placeOf(differences: readonly Difference[], line: ThreadLine): ThreadPlace {
  switch (line.kind) {
    case "removed":
      return { left: line.left + 1, right: gapAfter(differences, "left", line.left) };
    case "added":
      return { left: gapAfter(differences, "right", line.right), right: line.right + 1 };
    case "unchangedOnLeft":
    case "unchangedOnRight":
      return { left: line.left + 1, right: line.right + 1 };
    default: {
      const _exhaustive: never = line;
      return _exhaustive;
    }
  }
}

export function threadRows(
  differences: readonly Difference[],
  shown: readonly ShownThread[],
): ThreadRow[] {
  const rows = new Map<string, GrowingRow>();
  for (const thread of shown) {
    if (thread.shown === "collapsed") {
      continue;
    }
    const place = placeOf(differences, thread.line);
    const key = `${place.left}:${place.right}`;
    const unchanged =
      thread.line.kind === "unchangedOnLeft" || thread.line.kind === "unchangedOnRight";
    const row = rows.get(key) ?? { key, place, keys: { left: [], right: [] }, unchanged };
    row.keys[shownColumn(thread.line)].push(thread.key);
    rows.set(key, row);
  }
  return [...rows.values()].sort(({ place: a }, { place: b }) =>
    a.left === b.left ? a.right - b.right : a.left - b.left,
  );
}

export function rowHeight(row: ThreadRow, heightOf: (key: string) => number): number {
  function summed(keys: readonly string[]): number {
    return keys.reduce((total, key) => total + heightOf(key), 0);
  }
  return Math.max(summed(row.keys.left), summed(row.keys.right));
}
