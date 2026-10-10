import type { Range, Text } from "@codemirror/state";
import { Decoration, type DecorationSet } from "@codemirror/view";

import type { Chunk } from "../../ipc";
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
