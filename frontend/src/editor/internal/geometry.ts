import type { Text } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

import type { Span } from "../../connectors";
import type { Chunk } from "../../ipc";
import type { ChunkSpan } from "./chunkField";
import { lineSpan } from "./lineSpan";

export type Pane = "left" | "center" | "right";
export type PaneViews = Readonly<Record<Pane, EditorView>>;
export type ChunkRow = Readonly<Record<Pane, Span>> & { readonly chunk: Chunk };

export function rangeSpan(
  doc: Text,
  range: { readonly from: number; readonly to: number },
  blockAt: (pos: number) => Span,
): Span {
  const first = blockAt(range.from);
  if (range.from === range.to) {
    const y = doc.lineAt(range.from).from === range.from ? first.top : first.bottom;
    return { top: y, bottom: y };
  }
  const last = blockAt(range.to);
  return {
    top: first.top,
    bottom: doc.lineAt(range.to).from === range.to ? last.top : last.bottom,
  };
}

function viewSpan(view: EditorView, range: { readonly from: number; readonly to: number }): Span {
  return rangeSpan(view.state.doc, range, (pos) => view.lineBlockAt(pos));
}

export function chunkRows(
  views: PaneViews,
  chunks: readonly Chunk[],
  centerSpans: readonly ChunkSpan[],
): ChunkRow[] {
  return chunks.map((chunk, index) => {
    const center = centerSpans[index];
    if (center === undefined) {
      throw new Error(`chunk ${chunk.id} has no center range`);
    }
    return {
      chunk,
      left: viewSpan(views.left, lineSpan(views.left.state.doc, chunk.local)),
      center: viewSpan(views.center, center),
      right: viewSpan(views.right, lineSpan(views.right.state.doc, chunk.remote)),
    };
  });
}
