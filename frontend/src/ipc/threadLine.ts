import type * as Generated from "./bindings";
import type { Column } from "./compareDomain";
import { isLeftLine, isRightLine, type LeftLine, type RightLine } from "./domain";
import { invalid } from "./validate";

export type ThreadLine =
  | { readonly kind: "removed"; readonly left: LeftLine }
  | { readonly kind: "added"; readonly right: RightLine }
  | { readonly kind: "unchangedOnLeft"; readonly left: LeftLine; readonly right: RightLine }
  | { readonly kind: "unchangedOnRight"; readonly left: LeftLine; readonly right: RightLine };

export type ShownThread = {
  readonly key: string;
  readonly line: ThreadLine;
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

function leftLine(n: number, field: string): LeftLine {
  if (!isLeftLine(n)) {
    throw invalid(field, n);
  }
  return n;
}

function rightLine(n: number, field: string): RightLine {
  if (!isRightLine(n)) {
    throw invalid(field, n);
  }
  return n;
}

export function changedThreadLine(column: Column, line: number): ThreadLine {
  return column === "left"
    ? { kind: "removed", left: leftLine(line, "left line") }
    : { kind: "added", right: rightLine(line, "right line") };
}

export function unchangedThreadLine(
  column: Column,
  lines: { readonly left: number; readonly right: number },
): ThreadLine {
  const left = leftLine(lines.left, "left line");
  const right = rightLine(lines.right, "right line");
  return column === "left"
    ? { kind: "unchangedOnLeft", left, right }
    : { kind: "unchangedOnRight", left, right };
}

export function toThreadLine(raw: Generated.ThreadLine, field = "line"): ThreadLine {
  switch (raw.kind) {
    case "removed":
      return { kind: "removed", left: leftLine(raw.left, `${field}.left`) };
    case "added":
      return { kind: "added", right: rightLine(raw.right, `${field}.right`) };
    case "unchangedOnLeft":
    case "unchangedOnRight":
      return {
        kind: raw.kind,
        left: leftLine(raw.left, `${field}.left`),
        right: rightLine(raw.right, `${field}.right`),
      };
    default: {
      const _exhaustive: never = raw;
      return _exhaustive;
    }
  }
}

export function fromThreadLine(line: ThreadLine): Generated.ThreadLine {
  return line;
}
