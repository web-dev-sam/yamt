import "../theme.css";
import { RangeSetBuilder, StateField, type Extension, type Text } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";

import type { ChunkSpan } from "./chunkField";
import { lineSpan } from "./lineSpan";
import { sideChanged, type Side } from "./side";
import { isResolved, type ChunkState } from "./status";
import { chunkTone, type Tone } from "./tone";
import { centerWordMarks, sideWordMarks } from "./words";

type Band = { readonly from: number; readonly to: number; readonly tone: Tone };

function bandDecorations(doc: Text, bands: readonly Band[]): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to, tone } of bands) {
    let line = doc.lineAt(from);
    if (from === to) {
      const edge = line.from === from ? "chunk-point-above" : "chunk-point-below";
      builder.add(line.from, line.from, Decoration.line({ class: `chunk-marker-${tone} ${edge}` }));
      continue;
    }
    const band = Decoration.line({ class: `chunk-${tone} chunk-band` });
    builder.add(line.from, line.from, band);
    while (line.number < doc.lines && line.to + 1 < to) {
      line = doc.line(line.number + 1);
      builder.add(line.from, line.from, band);
    }
  }
  return builder.finish();
}

export function sideDecorations(
  statuses: StateField<readonly ChunkState[]>,
  side: Side,
): Extension {
  return EditorView.decorations.computeN([statuses], (state) => {
    const tinted = state
      .field(statuses)
      .filter(({ chunk, status }) => sideChanged(chunk, side) && !isResolved(chunk, status))
      .map(({ chunk }) => chunk);
    const bands = tinted.map((chunk) => ({
      ...lineSpan(state.doc, chunk[side]),
      tone: chunkTone(chunk, side),
    }));
    return [bandDecorations(state.doc, bands), sideWordMarks(state.doc, tinted, side)];
  });
}

const baseText = StateField.define<Text>({
  create: (state) => state.doc,
  update: (doc) => doc,
});

export function centerDecorations(field: StateField<readonly ChunkSpan[]>): Extension {
  return [
    baseText,
    EditorView.decorations.computeN([field, "doc"], (state) => {
      const tinted = state.field(field).filter(({ chunk, status }) => !isResolved(chunk, status));
      return [
        bandDecorations(state.doc, tinted),
        centerWordMarks(state.doc, state.field(baseText), tinted),
      ];
    }),
  ];
}
