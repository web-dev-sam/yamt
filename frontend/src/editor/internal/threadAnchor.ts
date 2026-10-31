import {
  changedThreadLine,
  unchangedThreadLine,
  type Column,
  type Difference,
  type ThreadLine,
} from "../../ipc";
import { segmentAt } from "./diffOrder";

export type LinePlace =
  | { readonly kind: "inside"; readonly difference: Difference }
  | { readonly kind: "between"; readonly partner: number };

export function linePlace(
  differences: readonly Difference[],
  column: Column,
  line: number,
): LinePlace {
  const segment = segmentAt(differences, column, line);
  if (segment.kind !== "unchanged") {
    return { kind: "inside", difference: segment.difference };
  }
  const other = column === "left" ? "right" : "left";
  return { kind: "between", partner: segment[other] + line - segment[column] };
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
