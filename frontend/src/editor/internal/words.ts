import type { Range, Text } from "@codemirror/state";
import { Decoration, type DecorationSet } from "@codemirror/view";

import type { Chunk } from "../../ipc";
import type { ChunkSpan } from "./chunkField";
import { lineSpan } from "./lineSpan";
import type { Side } from "./side";
import { chunkTone } from "./tone";

export function sideWordMarks(doc: Text, chunks: readonly Chunk[], side: Side): DecorationSet {
  const marks: Range<Decoration>[] = [];
  for (const chunk of chunks) {
    const mark = Decoration.mark({ class: `chunk-word-${chunkTone(chunk, side)}` });
    for (const range of chunk.words[side]) {
      const from = doc.line(range.line + 1).from + range.start;
      marks.push(mark.range(from, from + range.len));
    }
  }
  return Decoration.set(marks, true);
}

export function centerWordMarks(
  doc: Text,
  baseText: Text,
  spans: readonly ChunkSpan[],
): DecorationSet {
  const marks: Range<Decoration>[] = [];
  for (const span of spans) {
    if (span.chunk.words.base.length === 0) {
      continue;
    }
    const original = lineSpan(baseText, span.chunk.base);
    const untouched =
      span.to - span.from === original.to - original.from &&
      doc.sliceString(span.from, span.to) === baseText.sliceString(original.from, original.to);
    if (!untouched) {
      continue;
    }
    const mark = Decoration.mark({ class: `chunk-word-${span.tone}` });
    for (const range of span.chunk.words.base) {
      const from = span.from - original.from + baseText.line(range.line + 1).from + range.start;
      marks.push(mark.range(from, from + range.len));
    }
  }
  return Decoration.set(marks, true);
}
