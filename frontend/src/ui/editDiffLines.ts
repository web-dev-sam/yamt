import type { Difference } from "../ipc";

export const MAX_DIFF_ROWS = 2000;
const CONTEXT_LINES = 3;
const LONGEST_SHOWN_RUN = CONTEXT_LINES + CONTEXT_LINES;

/** Line numbers count from 1, as an editor's gutter shows them. */
export type DiffRow =
  | { readonly kind: "context"; readonly old: number; readonly new: number; readonly text: string }
  | { readonly kind: "removed"; readonly old: number; readonly text: string }
  | { readonly kind: "added"; readonly new: number; readonly text: string }
  | { readonly kind: "skipped"; readonly lines: number }
  | { readonly kind: "more"; readonly lines: number };

type Placed = Pick<Difference, "left" | "right">;

type Rows = { readonly shown: DiffRow[]; hidden: number };

/** Unchanged old lines `from` up to `to`; `shift` is how far the new text has moved them. */
type Run = { readonly from: number; readonly to: number; readonly shift: number };

/** Before the first change, between two, or after the last. */
type RunPlace = "start" | "between" | "end";

function linesOf(text: string): readonly string[] {
  if (text === "") {
    return [];
  }
  const lines = text.split("\n");
  return text.endsWith("\n") ? lines.slice(0, -1) : lines;
}

function add(rows: Rows, row: DiffRow): void {
  if (rows.shown.length < MAX_DIFF_ROWS) {
    rows.shown.push(row);
  } else if (row.kind !== "skipped") {
    rows.hidden += 1;
  }
}

function addContext(rows: Rows, old: readonly string[], { from, to, shift }: Run): void {
  for (let line = from; line < to; line += 1) {
    add(rows, { kind: "context", old: line + 1, new: line + shift + 1, text: old[line] ?? "" });
  }
}

function keptAround(length: number, place: RunPlace): { start: number; end: number } {
  const context = Math.min(CONTEXT_LINES, length);
  switch (place) {
    case "start":
      return { start: 0, end: context };
    case "end":
      return { start: context, end: 0 };
    case "between":
      return length <= LONGEST_SHOWN_RUN
        ? { start: length, end: 0 }
        : { start: context, end: context };
    default: {
      const _exhaustive: never = place;
      return _exhaustive;
    }
  }
}

function addUnchanged(rows: Rows, old: readonly string[], run: Run, place: RunPlace): void {
  const { from, to, shift } = run;
  const kept = keptAround(to - from, place);
  addContext(rows, old, { from, to: from + kept.start, shift });
  const skipped = to - from - kept.start - kept.end;
  if (skipped > 0) {
    add(rows, { kind: "skipped", lines: skipped });
  }
  addContext(rows, old, { from: to - kept.end, to, shift });
}

function addChange(
  rows: Rows,
  texts: { readonly old: readonly string[]; readonly new: readonly string[] },
  { left, right }: Placed,
): void {
  for (let line: number = left.start; line < left.start + left.len; line += 1) {
    add(rows, { kind: "removed", old: line + 1, text: texts.old[line] ?? "" });
  }
  for (let line: number = right.start; line < right.start + right.len; line += 1) {
    add(rows, { kind: "added", new: line + 1, text: texts.new[line] ?? "" });
  }
}

function finished(rows: Rows): readonly DiffRow[] {
  return rows.hidden === 0 ? rows.shown : [...rows.shown, { kind: "more", lines: rows.hidden }];
}

/** Unified rows: 3 unchanged lines around each change, the rest skipped, at most 2,000 rows. */
export function editDiffLines(
  oldText: string,
  newText: string,
  differences: readonly Placed[],
): readonly DiffRow[] {
  const texts = { old: linesOf(oldText), new: linesOf(newText) };
  const rows: Rows = { shown: [], hidden: 0 };
  let oldAt = 0;
  let shift = 0;
  differences.forEach((difference, index) => {
    const run = { from: oldAt, to: difference.left.start, shift };
    addUnchanged(rows, texts.old, run, index === 0 ? "start" : "between");
    addChange(rows, texts, difference);
    oldAt = difference.left.start + difference.left.len;
    shift = difference.right.start + difference.right.len - oldAt;
  });
  if (differences.length > 0) {
    addUnchanged(rows, texts.old, { from: oldAt, to: texts.old.length, shift }, "end");
  }
  return finished(rows);
}

/** A created file: every line added. */
export function createdFileLines(newText: string): readonly DiffRow[] {
  const rows: Rows = { shown: [], hidden: 0 };
  linesOf(newText).forEach((text, line) => {
    add(rows, { kind: "added", new: line + 1, text });
  });
  return finished(rows);
}
