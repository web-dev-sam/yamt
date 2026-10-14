import { EditorSelection, type SelectionRange } from "@codemirror/state";

import type { Hidden } from "./foldRuns";

function holds({ from, to }: Hidden, selection: SelectionRange): boolean {
  const { anchor, head } = selection;
  return (
    (anchor > from && anchor < to) ||
    (head > from && head < to) ||
    (!selection.empty && selection.from >= from && selection.to <= to)
  );
}

export function revealKeep(
  levels: readonly (Hidden | null)[],
  selection: SelectionRange,
): number | null {
  const found = levels.findLastIndex((hidden) => hidden !== null && holds(hidden, selection));
  return found < 0 ? null : levels.length - found - 1;
}

export function leaveHidden(
  range: SelectionRange,
  hidden: readonly Hidden[],
): SelectionRange | null {
  const around = hidden.find(({ from, to }) => range.head > from && range.head < to);
  if (around !== undefined) {
    return EditorSelection.cursor(around.from);
  }
  return hidden.some((one) => holds(one, range)) ? EditorSelection.cursor(range.head) : null;
}

export function leaveAllHidden(
  selection: EditorSelection,
  hidden: readonly Hidden[],
): EditorSelection | null {
  const ranges = selection.ranges.map((range) => leaveHidden(range, hidden) ?? range);
  if (ranges.every((range, index) => range === selection.ranges[index])) {
    return null;
  }
  return EditorSelection.create(ranges, selection.mainIndex);
}
