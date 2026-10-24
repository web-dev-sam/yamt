import type { Column } from "./compareDomain";
import { isLeftLine, isRightLine, type LeftLine, type RightLine } from "./domain";
import { invalid } from "./validate";

export type ThreadLine =
  | { readonly kind: "removed"; readonly left: LeftLine }
  | { readonly kind: "added"; readonly right: RightLine }
  | { readonly kind: "unchangedOnLeft"; readonly left: LeftLine; readonly right: RightLine }
  | { readonly kind: "unchangedOnRight"; readonly left: LeftLine; readonly right: RightLine };

export function shownColumn(line: ThreadLine): Column {
  switch (line.kind) {
    case "removed":
    case "unchangedOnLeft":
      return "left";
    case "added":
    case "unchangedOnRight":
      return "right";
    default: {
      const _exhaustive: never = line;
      return _exhaustive;
    }
  }
}

function leftLine(n: number): LeftLine {
  if (!isLeftLine(n)) {
    throw invalid("left line", n);
  }
  return n;
}

function rightLine(n: number): RightLine {
  if (!isRightLine(n)) {
    throw invalid("right line", n);
  }
  return n;
}

export function changedThreadLine(column: Column, line: number): ThreadLine {
  return column === "left"
    ? { kind: "removed", left: leftLine(line) }
    : { kind: "added", right: rightLine(line) };
}

export function unchangedThreadLine(
  column: Column,
  lines: { readonly left: number; readonly right: number },
): ThreadLine {
  const left = leftLine(lines.left);
  const right = rightLine(lines.right);
  return column === "left"
    ? { kind: "unchangedOnLeft", left, right }
    : { kind: "unchangedOnRight", left, right };
}
