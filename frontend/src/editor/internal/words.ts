import type { EditorState, Range, Text } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";

import type { Chunk } from "../../ipc";
import type { Side } from "./side";
import { chunkTone, type Tone } from "./tone";

export const REMOVAL_BAR_CLASS = "chunk-removal";

class RemovalPoint extends WidgetType {
  readonly className: string;
  readonly text: string;

  constructor(tone: Tone, text: string) {
    super();
    this.className = `${REMOVAL_BAR_CLASS} ${REMOVAL_BAR_CLASS}-${tone}`;
    this.text = text;
  }

  override eq(other: RemovalPoint): boolean {
    return other.className === this.className && other.text === this.text;
  }

  toDOM(): HTMLElement {
    const bar = document.createElement("span");
    bar.className = this.className;
    return bar;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

export function removalAt(state: EditorState, pos: number): string | null {
  for (const source of state.facet(EditorView.decorations)) {
    if (typeof source === "function") {
      continue;
    }
    for (
      const cursor = source.iter(pos);
      cursor.value !== null && cursor.from <= pos;
      cursor.next()
    ) {
      const widget: unknown = cursor.value.spec.widget;
      if (widget instanceof RemovalPoint) {
        return widget.text;
      }
    }
  }
  return null;
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
    for (const removal of chunk.words[side].removals) {
      const bar = Decoration.widget({ widget: new RemovalPoint(tone, removal.text) });
      decorations.push(bar.range(doc.line(removal.at.line + 1).from + removal.at.column));
    }
  }
  return Decoration.set(decorations, true);
}
