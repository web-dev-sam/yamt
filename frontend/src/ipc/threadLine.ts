import type * as Generated from "./bindings";
import type { Column } from "./compareDomain";
import { isLeftLine, isRightLine, type LeftLine, type RightLine } from "./domain";
import { branded } from "./validate";

export type ThreadLine =
  | { readonly kind: "removed"; readonly left: LeftLine }
  | { readonly kind: "added"; readonly right: RightLine }
  | { readonly kind: "unchangedOnLeft"; readonly left: LeftLine; readonly right: RightLine }
  | { readonly kind: "unchangedOnRight"; readonly left: LeftLine; readonly right: RightLine };

/** A line of the diff in GitLab's one-column order: an unchanged line once, a change's removed lines, then its added lines. */
export type DiffLine =
  | { readonly kind: "removed"; readonly left: LeftLine }
  | { readonly kind: "added"; readonly right: RightLine }
  | { readonly kind: "unchanged"; readonly left: LeftLine; readonly right: RightLine };

/** From `start` to `end` in GitLab's order, both included; one line when `start` is `end`'s line. `end` decides the box's column. */
export type ThreadPlace = { readonly start: DiffLine; readonly end: ThreadLine };

export type ShownThread = {
  readonly key: string;
  readonly place: ThreadPlace;
  readonly shown: "open" | "collapsed" | "draft";
};

export function shownLine(line: ThreadLine): { readonly column: Column; readonly line: number } {
  switch (line.kind) {
    case "removed":
    case "unchangedOnLeft":
      return { column: "left", line: line.left };
    case "added":
    case "unchangedOnRight":
      return { column: "right", line: line.right };
    default: {
      const _exhaustive: never = line;
      return _exhaustive;
    }
  }
}

export function shownColumn(line: ThreadLine): Column {
  return shownLine(line).column;
}

export function changedThreadLine(column: Column, line: number): ThreadLine {
  return column === "left"
    ? { kind: "removed", left: branded(line, isLeftLine, "left line") }
    : { kind: "added", right: branded(line, isRightLine, "right line") };
}

export function unchangedThreadLine(
  column: Column,
  lines: { readonly left: number; readonly right: number },
): ThreadLine {
  const left = branded(lines.left, isLeftLine, "left line");
  const right = branded(lines.right, isRightLine, "right line");
  return column === "left"
    ? { kind: "unchangedOnLeft", left, right }
    : { kind: "unchangedOnRight", left, right };
}

/** The line without the column it was picked in: `unchangedOnLeft`/`unchangedOnRight` → `unchanged`. */
export function diffLineOf(line: ThreadLine): DiffLine {
  return line.kind === "unchangedOnLeft" || line.kind === "unchangedOnRight"
    ? { kind: "unchanged", left: line.left, right: line.right }
    : line;
}

/** The one-line place on `line`: `{ start: diffLineOf(line), end: line }`. */
export function onePlace(line: ThreadLine): ThreadPlace {
  return { start: diffLineOf(line), end: line };
}

export function sameDiffLine(a: DiffLine, b: DiffLine): boolean {
  switch (a.kind) {
    case "removed":
      return b.kind === "removed" && a.left === b.left;
    case "added":
      return b.kind === "added" && a.right === b.right;
    case "unchanged":
      return b.kind === "unchanged" && a.left === b.left && a.right === b.right;
    default: {
      const _exhaustive: never = a;
      return _exhaustive;
    }
  }
}

/** `start` is `end`'s own line. */
export function isOneLine(place: ThreadPlace): boolean {
  return sameDiffLine(place.start, diffLineOf(place.end));
}

function toThreadLine(raw: Generated.ThreadLine, field: string): ThreadLine {
  switch (raw.kind) {
    case "removed":
      return { kind: "removed", left: branded(raw.left, isLeftLine, `${field}.left`) };
    case "added":
      return { kind: "added", right: branded(raw.right, isRightLine, `${field}.right`) };
    case "unchangedOnLeft":
    case "unchangedOnRight":
      return {
        kind: raw.kind,
        left: branded(raw.left, isLeftLine, `${field}.left`),
        right: branded(raw.right, isRightLine, `${field}.right`),
      };
    default: {
      const _exhaustive: never = raw;
      return _exhaustive;
    }
  }
}

function toDiffLine(raw: Generated.DiffLine, field: string): DiffLine {
  switch (raw.kind) {
    case "removed":
      return { kind: "removed", left: branded(raw.left, isLeftLine, `${field}.left`) };
    case "added":
      return { kind: "added", right: branded(raw.right, isRightLine, `${field}.right`) };
    case "unchanged":
      return {
        kind: "unchanged",
        left: branded(raw.left, isLeftLine, `${field}.left`),
        right: branded(raw.right, isRightLine, `${field}.right`),
      };
    default: {
      const _exhaustive: never = raw;
      return _exhaustive;
    }
  }
}

/** Brands every number, naming the field (`${field}.start.left`, `${field}.end.right`, …) on a bad one. */
export function toThreadPlace(raw: Generated.ThreadPlace, field = "place"): ThreadPlace {
  return {
    start: toDiffLine(raw.start, `${field}.start`),
    end: toThreadLine(raw.end, `${field}.end`),
  };
}

export function fromThreadPlace(place: ThreadPlace): Generated.ThreadPlace {
  return place;
}
