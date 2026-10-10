import type { Range, Text } from "@codemirror/state";
import { Decoration, WidgetType, type DecorationSet } from "@codemirror/view";

import type { Chunk } from "../../ipc";
import type { Side } from "./side";
import { chunkTone, type Tone } from "./tone";

class RemovalPoint extends WidgetType {
  readonly tone: Tone;

  constructor(tone: Tone) {
    super();
    this.tone = tone;
  }

  override eq(other: RemovalPoint): boolean {
    return other.tone === this.tone;
  }

  toDOM(): HTMLElement {
    const bar = document.createElement("span");
    bar.className = `chunk-removal chunk-removal-${this.tone}`;
    return bar;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

export function sideWordDecorations(
  doc: Text,
  chunks: readonly Chunk[],
  side: Side,
): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  for (const chunk of chunks) {
    const tone = chunkTone(chunk, side);
    const mark = Decoration.mark({ class: `chunk-word-${tone}` });
    for (const range of chunk.words[side].changed) {
      const from = doc.line(range.line + 1).from + range.start;
      decorations.push(mark.range(from, from + range.len));
    }
    const bar = Decoration.widget({ widget: new RemovalPoint(tone) });
    for (const point of chunk.words[side].removedAt) {
      decorations.push(bar.range(doc.line(point.line + 1).from + point.column));
    }
  }
  return Decoration.set(decorations, true);
}
