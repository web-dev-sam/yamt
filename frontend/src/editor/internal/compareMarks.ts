import type { Range, Text } from "@codemirror/state";
import { Decoration, type DecorationSet } from "@codemirror/view";

import type { Column, Difference } from "../../ipc";
import { bandDecorations } from "./decorations";
import { toDocPos, type DocPos } from "./docPos";
import { lineSpan } from "./lineSpan";
import { changeTone, type ChangeTone } from "./tone";
import { wordDecorations } from "./words";

export type DiffSpan = { readonly from: DocPos; readonly to: DocPos; readonly tone: ChangeTone };
export type ColumnMarks = {
  readonly spans: readonly DiffSpan[];
  readonly bands: DecorationSet;
  readonly words: DecorationSet;
};

export function columnMarks(
  doc: Text,
  differences: readonly Difference[],
  column: Column,
): ColumnMarks {
  const spans: DiffSpan[] = [];
  const words: Range<Decoration>[] = [];
  for (const difference of differences) {
    const { from, to } = lineSpan(doc, difference[column]);
    const tone = changeTone(difference.left.len, difference.right.len);
    spans.push({ from: toDocPos(from), to: toDocPos(to), tone });
    for (const word of wordDecorations(doc, difference.words[column], tone)) {
      words.push(word);
    }
  }
  return { spans, bands: bandDecorations(doc, spans), words: Decoration.set(words, true) };
}
