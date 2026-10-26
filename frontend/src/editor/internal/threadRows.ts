import {
  shownColumn,
  type Column,
  type Difference,
  type ShownThread,
  type ThreadLine,
} from "../../ipc";
import { linePlace } from "./threadAnchor";

export type { ShownThread } from "../../ipc";

type ThreadPlace = Readonly<Record<Column, number>>;

export type RowKind = "unchanged" | "changed" | "leftEmpty" | "rightEmpty";

export type ThreadRow = {
  readonly key: string;
  readonly place: ThreadPlace;
  readonly keys: Readonly<Record<Column, readonly string[]>>;
  readonly kind: RowKind;
};

type GrowingRow = Omit<ThreadRow, "keys"> & { readonly keys: Record<Column, string[]> };

type Placed = { readonly place: ThreadPlace; readonly kind: RowKind };

const EMPTY_KIND: Readonly<Record<Column, RowKind>> = { left: "leftEmpty", right: "rightEmpty" };

export function sitsBeforePlace(row: ThreadRow, column: Column): boolean {
  return row.kind === EMPTY_KIND[column];
}

function gapAfter(
  differences: readonly Difference[],
  column: Column,
  line: number,
): { readonly place: number; readonly kind: RowKind } {
  const place = linePlace(differences, column, line);
  if (place.kind === "between") {
    return { place: place.partner + 1, kind: "changed" };
  }
  const otherColumn = column === "left" ? "right" : "left";
  const other = place.difference[otherColumn];
  return {
    place: other.start + other.len,
    kind: other.len === 0 ? EMPTY_KIND[otherColumn] : "changed",
  };
}

function placeOf(differences: readonly Difference[], line: ThreadLine): Placed {
  switch (line.kind) {
    case "removed": {
      const gap = gapAfter(differences, "left", line.left);
      return { place: { left: line.left + 1, right: gap.place }, kind: gap.kind };
    }
    case "added": {
      const gap = gapAfter(differences, "right", line.right);
      return { place: { left: gap.place, right: line.right + 1 }, kind: gap.kind };
    }
    case "unchangedOnLeft":
    case "unchangedOnRight":
      return { place: { left: line.left + 1, right: line.right + 1 }, kind: "unchanged" };
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
    const { place, kind } = placeOf(differences, thread.line);
    const key = `${place.left}:${place.right}`;
    const row = rows.get(key) ?? { key, place, keys: { left: [], right: [] }, kind };
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
