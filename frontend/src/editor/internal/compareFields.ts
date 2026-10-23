import { StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";

import type { ColumnMarks } from "./compareMarks";
import { toDocPos } from "./docPos";

export const showDifferences = StateEffect.define<ColumnMarks>();

export const differenceField = StateField.define<ColumnMarks>({
  create: () => ({ spans: [], bands: Decoration.none, words: Decoration.none }),
  update(marks, tr) {
    let shown: ColumnMarks | null = null;
    for (const effect of tr.effects) {
      if (effect.is(showDifferences)) {
        shown = effect.value;
      }
    }
    if (shown !== null) {
      return shown;
    }
    if (!tr.docChanged) {
      return marks;
    }
    return {
      spans: marks.spans.map(({ from, to, tone }) => ({
        from: toDocPos(tr.changes.mapPos(from, -1)),
        to: toDocPos(tr.changes.mapPos(to, -1)),
        tone,
      })),
      bands: marks.bands.map(tr.changes),
      words: marks.words.map(tr.changes),
    };
  },
  provide: (field) => [
    EditorView.decorations.from(field, (marks) => marks.bands),
    EditorView.decorations.from(field, (marks) => marks.words),
  ],
});
