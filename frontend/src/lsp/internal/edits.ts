import type { TextEdit } from "./protocol";

export type EditResult =
  | { readonly kind: "applied"; readonly text: string }
  | { readonly kind: "overlapping" };

type Line = { readonly start: number; readonly end: number };

type Span = { readonly from: number; readonly to: number; readonly insert: string };

const LINE_BREAK = /\r\n|\r|\n/g;

function linesOf(text: string): Line[] {
  const lines: Line[] = [];
  let start = 0;
  for (const match of text.matchAll(LINE_BREAK)) {
    lines.push({ start, end: match.index });
    start = match.index + match[0].length;
  }
  lines.push({ start, end: text.length });
  return lines;
}

function offsetOf(
  text: string,
  lines: readonly Line[],
  position: TextEdit["range"]["start"],
): number {
  const line = lines[position.line];
  return line === undefined ? text.length : Math.min(line.start + position.character, line.end);
}

export function applyEdits(text: string, edits: readonly TextEdit[]): EditResult {
  const lines = linesOf(text);
  const spans: Span[] = edits
    .map((edit) => ({
      from: offsetOf(text, lines, edit.range.start),
      to: offsetOf(text, lines, edit.range.end),
      insert: edit.newText,
    }))
    .toSorted((a, b) => a.from - b.from);
  const overlapping = spans.some(
    (span, index) => span.to < span.from || span.from < (spans[index - 1]?.to ?? 0),
  );
  if (overlapping) {
    return { kind: "overlapping" };
  }
  let result = text;
  for (const span of spans.toReversed()) {
    result = result.slice(0, span.from) + span.insert + result.slice(span.to);
  }
  return { kind: "applied", text: result };
}
