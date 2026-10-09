import "../theme.css";
import { RangeSetBuilder, type Extension, type StateField, type Text } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";

import type { Chunk } from "../../ipc";
import type { ChunkSpan } from "./chunkField";
import { lineSpan } from "./lineSpan";
import { sideChanged, type Side } from "./side";
import { chunkTone, type Tone } from "./tone";

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

export function sideDecorations(chunks: readonly Chunk[], side: Side): Extension {
  return EditorView.decorations.compute([], (state) =>
    bandDecorations(
      state.doc,
      chunks
        .filter((chunk) => sideChanged(chunk, side))
        .map((chunk) => ({ ...lineSpan(state.doc, chunk[side]), tone: chunkTone(chunk, side) })),
    ),
  );
}

export function centerDecorations(field: StateField<readonly ChunkSpan[]>): Extension {
  return EditorView.decorations.compute([field], (state) =>
    bandDecorations(state.doc, state.field(field)),
  );
}
