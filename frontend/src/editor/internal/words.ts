import { StateField, type Extension, type Range, type Text } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";

import type { ChunkSpan } from "./chunkField";
import { lineSpan } from "./lineSpan";
import { sideChanged, type Side } from "./side";
import { isResolved, type ChunkState } from "./status";
import { chunkTone } from "./tone";

const originalDoc = StateField.define<Text>({
  create: (state) => state.doc,
  update: (doc) => doc,
});

function sideMarks(doc: Text, states: readonly ChunkState[], side: Side): DecorationSet {
  const marks: Range<Decoration>[] = [];
  for (const { chunk, status } of states) {
    if (!sideChanged(chunk, side) || isResolved(chunk, status)) {
      continue;
    }
    const mark = Decoration.mark({ class: `chunk-word-${chunkTone(chunk, side)}` });
    for (const range of chunk.words[side]) {
      const from = doc.line(range.line + 1).from + range.start;
      marks.push(mark.range(from, from + range.len));
    }
  }
  return Decoration.set(marks, true);
}

function centerMarks(doc: Text, base: Text, spans: readonly ChunkSpan[]): DecorationSet {
  const marks: Range<Decoration>[] = [];
  for (const span of spans) {
    if (span.chunk.words.base.length === 0 || isResolved(span.chunk, span.status)) {
      continue;
    }
    const original = lineSpan(base, span.chunk.base);
    const untouched =
      span.to - span.from === original.to - original.from &&
      doc.sliceString(span.from, span.to) === base.sliceString(original.from, original.to);
    if (!untouched) {
      continue;
    }
    const mark = Decoration.mark({ class: `chunk-word-${span.tone}` });
    for (const range of span.chunk.words.base) {
      const from = span.from - original.from + base.line(range.line + 1).from + range.start;
      marks.push(mark.range(from, from + range.len));
    }
  }
  return Decoration.set(marks, true);
}

export function sideWordMarks(statuses: StateField<readonly ChunkState[]>, side: Side): Extension {
  return EditorView.decorations.compute([statuses], (state) =>
    sideMarks(state.doc, state.field(statuses), side),
  );
}

export function centerWordMarks(field: StateField<readonly ChunkSpan[]>): Extension {
  return [
    originalDoc,
    EditorView.decorations.compute([field, "doc"], (state) =>
      centerMarks(state.doc, state.field(originalDoc), state.field(field)),
    ),
  ];
}
