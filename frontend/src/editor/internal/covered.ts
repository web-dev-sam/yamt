import { StateEffect, StateField, type Extension } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";

import type { ChunkAction } from "./apply";
import type { Side } from "./side";

export const showCovered = StateEffect.define<ChunkAction | null>();

export const coveredField = StateField.define<ChunkAction | null>({
  create: () => null,
  update(covered, tr) {
    const shown = tr.effects.findLast((effect) => effect.is(showCovered));
    return shown === undefined ? covered : shown.value;
  },
});

const coveredLine = Decoration.line({ class: "chunk-covered" });

export function coveredDecorations(side: Side): Extension {
  return [
    coveredField,
    EditorView.decorations.compute([coveredField], (state) => {
      const covered = state.field(coveredField);
      if (covered === null || covered.side !== side) {
        return Decoration.none;
      }
      const lines = covered.chunks.flatMap(({ [side]: range }) =>
        Array.from({ length: range.len }, (_, index) =>
          coveredLine.range(state.doc.line(range.start + 1 + index).from),
        ),
      );
      return Decoration.set(lines, true);
    }),
  ];
}

export function sameCovered(a: ChunkAction | null, b: ChunkAction | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  return (
    a.kind === b.kind &&
    a.side === b.side &&
    a.chunks.length === b.chunks.length &&
    a.chunks.every((chunk, index) => chunk.id === b.chunks[index]?.id)
  );
}
