import {
  changedThreadLine,
  diffLineOf,
  shownColumn,
  unchangedThreadLine,
  type Column,
  type Difference,
  type DiffLine,
  type ThreadLine,
  type ThreadPlace,
} from "../../ipc";
import type { ColumnChange, LineSpan } from "./foldRuns";

type Segment = {
  readonly kind: DiffLine["kind"];
  readonly index: number;
  readonly left: number;
  readonly right: number;
  readonly len: number;
};

type Overlap = { readonly segment: Segment; readonly offset: number; readonly len: number };

const CHANGED_KIND = { left: "removed", right: "added" } as const satisfies Readonly<
  Record<Column, DiffLine["kind"]>
>;

function segments(differences: readonly Difference[]): Segment[] {
  const order: Segment[] = [];
  let index = 0;
  let left = 0;
  let right = 0;
  for (const difference of differences) {
    const unchanged = difference.left.start - left;
    order.push({ kind: "unchanged", index, left, right, len: unchanged });
    index += unchanged;
    left = difference.left.start + difference.left.len;
    order.push({
      kind: "removed",
      index,
      left: difference.left.start,
      right,
      len: difference.left.len,
    });
    index += difference.left.len;
    right = difference.right.start + difference.right.len;
    order.push({
      kind: "added",
      index,
      left,
      right: difference.right.start,
      len: difference.right.len,
    });
    index += difference.right.len;
  }
  order.push({ kind: "unchanged", index, left, right, len: Infinity });
  return order;
}

function indexIn(order: readonly Segment[], column: Column, line: number): number {
  const segment = order
    .filter(({ kind }) => kind === "unchanged" || kind === CHANGED_KIND[column])
    .reduce((found, next) => (next[column] <= line ? next : found));
  return segment.index + line - segment[column];
}

function orderIndexIn(order: readonly Segment[], line: DiffLine): number {
  switch (line.kind) {
    case "added":
      return indexIn(order, "right", line.right);
    case "removed":
    case "unchanged":
      return indexIn(order, "left", line.left);
  }
}

function lineIn(order: readonly Segment[], index: number): DiffLine {
  const segment = order.reduce((found, next) => (next.index <= index ? next : found));
  const offset = index - segment.index;
  switch (segment.kind) {
    case "removed":
      return diffLineOf(changedThreadLine("left", segment.left + offset));
    case "added":
      return diffLineOf(changedThreadLine("right", segment.right + offset));
    case "unchanged":
      return diffLineOf(
        unchangedThreadLine("left", { left: segment.left + offset, right: segment.right + offset }),
      );
  }
}

function threadLineOf(line: DiffLine, column: Column): ThreadLine {
  switch (line.kind) {
    case "removed":
      return changedThreadLine("left", line.left);
    case "added":
      return changedThreadLine("right", line.right);
    case "unchanged":
      return unchangedThreadLine(column, line);
  }
}

export function orderIndex(differences: readonly Difference[], line: DiffLine): number {
  return orderIndexIn(segments(differences), line);
}

export function lineAtIndex(differences: readonly Difference[], index: number): DiffLine {
  return lineIn(segments(differences), index);
}

/** The earlier of the two in GitLab's order is `start` (its DiffLine), the later `end` (its ThreadLine, keeping the
 *  column it was picked in); the same index gives `onePlace(press)`. */
export function placeBetween(
  differences: readonly Difference[],
  press: ThreadLine,
  pointer: ThreadLine,
): ThreadPlace {
  const order = segments(differences);
  const from = orderIndexIn(order, diffLineOf(press));
  const to = orderIndexIn(order, diffLineOf(pointer));
  return from < to
    ? { start: diffLineOf(press), end: pointer }
    : { start: diffLineOf(pointer), end: press };
}

/** `pointer` clamped to the unbroken run of shown lines around `press` (a collapsed run hides unchanged lines in both
 *  columns: one stretch of indices); a clamped unchanged end takes the pointer's column. */
export function shownEnd(
  differences: readonly Difference[],
  hiddenLeft: readonly LineSpan[],
  press: ThreadLine,
  pointer: ThreadLine,
): ThreadLine {
  const order = segments(differences);
  const from = orderIndexIn(order, diffLineOf(press));
  const to = orderIndexIn(order, diffLineOf(pointer));
  const hidden = hiddenLeft.map(({ start, len }) => ({
    first: indexIn(order, "left", start),
    last: indexIn(order, "left", start + len - 1),
  }));
  const end =
    to > from
      ? Math.min(to, ...hidden.filter(({ first }) => first > from).map(({ first }) => first - 1))
      : Math.max(to, ...hidden.filter(({ last }) => last < from).map(({ last }) => last + 1));
  return threadLineOf(lineIn(order, end), shownColumn(pointer));
}

function overlaps(differences: readonly Difference[], place: ThreadPlace): Overlap[] {
  const order = segments(differences);
  const from = orderIndexIn(order, place.start);
  const to = orderIndexIn(order, diffLineOf(place.end)) + 1;
  return order.flatMap((segment) => {
    const first = Math.max(from, segment.index);
    const end = Math.min(to, segment.index + segment.len);
    return end > first ? [{ segment, offset: first - segment.index, len: end - first }] : [];
  });
}

/** Per column, the lines to tint: unchanged in both, removed in the left, added in the right. */
export function placeSpans(
  differences: readonly Difference[],
  place: ThreadPlace,
): Readonly<Record<Column, readonly LineSpan[]>> {
  const spans: Record<Column, LineSpan[]> = { left: [], right: [] };
  for (const { segment, offset, len } of overlaps(differences, place)) {
    for (const column of ["left", "right"] satisfies readonly Column[]) {
      if (segment.kind === "unchanged" || segment.kind === CHANGED_KIND[column]) {
        spans[column].push({ start: segment[column] + offset, len });
      }
    }
  }
  return spans;
}

/** The place's unchanged lines, one ColumnChange per stretch between differences. */
export function unchangedRuns(
  differences: readonly Difference[],
  place: ThreadPlace,
): ColumnChange[] {
  return overlaps(differences, place)
    .filter(({ segment }) => segment.kind === "unchanged")
    .map(({ segment, offset, len }) => ({
      left: { start: segment.left + offset, len },
      right: { start: segment.right + offset, len },
    }));
}
