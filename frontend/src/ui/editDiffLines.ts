import type { Difference } from "../ipc";
import { LINE_ENDING_WORDS, moreLinesText, NO_NEWLINE_TEXT, skippedLinesText } from "./aiText";

export const MAX_DIFF_ROWS = 2000;
const CONTEXT_LINES = 3;
const LONGEST_SHOWN_RUN = CONTEXT_LINES + CONTEXT_LINES;
const CR = "\r";

type LineEnding = keyof typeof LINE_ENDING_WORDS;

/**
 * Line numbers count from 1, as an editor's gutter shows them. A changed row's `ending` is set
 * only when its paired row differs from it by nothing but the line ending.
 */
export type DiffRow =
  | { readonly kind: "context"; readonly old: number; readonly new: number; readonly text: string }
  | {
      readonly kind: "removed";
      readonly old: number;
      readonly text: string;
      readonly ending: LineEnding | null;
    }
  | {
      readonly kind: "added";
      readonly new: number;
      readonly text: string;
      readonly ending: LineEnding | null;
    }
  | { readonly kind: "noNewline" }
  | { readonly kind: "skipped"; readonly lines: number }
  | { readonly kind: "more"; readonly lines: number };

type DiffRowCells = {
  readonly old: string;
  readonly new: string;
  readonly sign: string;
  readonly text: string;
  readonly note: string;
};

type Placed = Pick<Difference, "left" | "right">;

/** A side's lines as Rust counts them; `open` when its last line has no line break. */
type Side = { readonly lines: readonly string[]; readonly open: boolean };

type Texts = { readonly old: Side; readonly new: Side };

type Rows = { readonly shown: DiffRow[]; hidden: number };

/** Unchanged old lines `from` up to `to`; `shift` is how far the new text has moved them. */
type Run = { readonly from: number; readonly to: number; readonly shift: number };

/** Before the first change, between two, or after the last. */
type RunPlace = "start" | "between" | "end";

function sideOf(text: string): Side {
  if (text === "") {
    return { lines: [], open: false };
  }
  const lines = text.split("\n");
  return text.endsWith("\n") ? { lines: lines.slice(0, -1), open: false } : { lines, open: true };
}

function withoutCr(line: string): string {
  return line.endsWith(CR) ? line.slice(0, -CR.length) : line;
}

function pairEnding(line: string, pair: string | undefined): LineEnding | null {
  if (pair === undefined || line === pair || withoutCr(line) !== withoutCr(pair)) {
    return null;
  }
  return line.endsWith(CR) ? "crlf" : "lf";
}

function add(rows: Rows, row: DiffRow): void {
  if (rows.shown.length < MAX_DIFF_ROWS) {
    rows.shown.push(row);
  } else if (row.kind === "context" || row.kind === "removed" || row.kind === "added") {
    rows.hidden += 1;
  }
}

function addLastLine(rows: Rows, side: Side, line: number): void {
  if (side.open && line === side.lines.length - 1) {
    add(rows, { kind: "noNewline" });
  }
}

function addContext(rows: Rows, old: Side, { from, to, shift }: Run): void {
  for (let line = from; line < to; line += 1) {
    const text = withoutCr(old.lines[line] ?? "");
    add(rows, { kind: "context", old: line + 1, new: line + shift + 1, text });
    addLastLine(rows, old, line);
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

function addUnchanged(rows: Rows, old: Side, run: Run, place: RunPlace): void {
  const { from, to, shift } = run;
  const kept = keptAround(to - from, place);
  addContext(rows, old, { from, to: from + kept.start, shift });
  const skipped = to - from - kept.start - kept.end;
  if (skipped > 0) {
    add(rows, { kind: "skipped", lines: skipped });
  }
  addContext(rows, old, { from: to - kept.end, to, shift });
}

function addChange(rows: Rows, texts: Texts, { left, right }: Placed): void {
  for (let index = 0; index < left.len; index += 1) {
    const line = left.start + index;
    const text = texts.old.lines[line] ?? "";
    const pair = index < right.len ? texts.new.lines[right.start + index] : undefined;
    add(rows, {
      kind: "removed",
      old: line + 1,
      text: withoutCr(text),
      ending: pairEnding(text, pair),
    });
    addLastLine(rows, texts.old, line);
  }
  for (let index = 0; index < right.len; index += 1) {
    const line = right.start + index;
    const text = texts.new.lines[line] ?? "";
    const pair = index < left.len ? texts.old.lines[left.start + index] : undefined;
    add(rows, {
      kind: "added",
      new: line + 1,
      text: withoutCr(text),
      ending: pairEnding(text, pair),
    });
    addLastLine(rows, texts.new, line);
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
  const texts: Texts = { old: sideOf(oldText), new: sideOf(newText) };
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
    addUnchanged(rows, texts.old, { from: oldAt, to: texts.old.lines.length, shift }, "end");
  }
  return finished(rows);
}

/** A created file: every line added. */
export function createdFileLines(newText: string): readonly DiffRow[] {
  const side = sideOf(newText);
  const rows: Rows = { shown: [], hidden: 0 };
  side.lines.forEach((text, line) => {
    add(rows, { kind: "added", new: line + 1, text: withoutCr(text), ending: null });
    addLastLine(rows, side, line);
  });
  return finished(rows);
}

/** What each of a row's four columns shows, and the note after its text. */
export function diffRowCells(row: DiffRow): DiffRowCells {
  const none = { old: "", new: "", sign: "", note: "" };
  switch (row.kind) {
    case "context":
      return { ...none, old: String(row.old), new: String(row.new), sign: " ", text: row.text };
    case "removed": {
      const note = row.ending === null ? "" : LINE_ENDING_WORDS[row.ending];
      return { ...none, old: String(row.old), sign: "−", text: row.text, note };
    }
    case "added": {
      const note = row.ending === null ? "" : LINE_ENDING_WORDS[row.ending];
      return { ...none, new: String(row.new), sign: "+", text: row.text, note };
    }
    case "noNewline":
      return { ...none, text: NO_NEWLINE_TEXT };
    case "skipped":
      return { ...none, text: skippedLinesText(row.lines) };
    case "more":
      return { ...none, text: moreLinesText(row.lines) };
    default: {
      const _exhaustive: never = row;
      return _exhaustive;
    }
  }
}
