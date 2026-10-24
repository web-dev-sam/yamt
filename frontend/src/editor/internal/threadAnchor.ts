import {
  changedThreadLine,
  unchangedThreadLine,
  type Column,
  type Difference,
  type ThreadLine,
} from "../../ipc";

export type LinePlace =
  | { readonly kind: "inside"; readonly difference: Difference }
  | { readonly kind: "between"; readonly partner: number };

export function linePlace(
  differences: readonly Difference[],
  column: Column,
  line: number,
): LinePlace {
  const other = column === "left" ? "right" : "left";
  let offset = 0;
  for (const difference of differences) {
    const here = difference[column];
    if (line < here.start) {
      break;
    }
    if (line < here.start + here.len) {
      return { kind: "inside", difference };
    }
    offset += difference[other].len - here.len;
  }
  return { kind: "between", partner: line + offset };
}

export function anchorAt(
  differences: readonly Difference[],
  column: Column,
  line: number,
): ThreadLine {
  const place = linePlace(differences, column, line);
  if (place.kind === "inside") {
    return changedThreadLine(column, line);
  }
  const lines =
    column === "left" ? { left: line, right: place.partner } : { left: place.partner, right: line };
  return unchangedThreadLine(column, lines);
}
