import type { StateField, Text } from "@codemirror/state";
import type { EditorView, ViewUpdate } from "@codemirror/view";

import type { Span } from "../../connectors";
import type { ChunkSpan } from "./chunkField";
import { lineSpan } from "./lineSpan";
import type { Side } from "./side";
import type { ChunkState } from "./status";

export type Pane = "left" | "center" | "right";
export type PaneViews = Readonly<Record<Pane, EditorView>>;
export type ChunkRow = Readonly<Record<Pane, Span>> & ChunkState;

export const SIDE_PANE: Readonly<Record<Side, "left" | "right">> = {
  local: "left",
  remote: "right",
};

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

export function chunkRows(views: PaneViews, centerSpans: readonly ChunkSpan[]): ChunkRow[] {
  return centerSpans.map((center) => ({
    chunk: center.chunk,
    status: center.status,
    left: viewSpan(views.left, lineSpan(views.left.state.doc, center.chunk.local)),
    center: viewSpan(views.center, center),
    right: viewSpan(views.right, lineSpan(views.right.state.doc, center.chunk.remote)),
  }));
}

export function rowsChanged(
  update: Pick<ViewUpdate, "geometryChanged" | "startState" | "state">,
  fields: readonly StateField<unknown>[],
): boolean {
  return (
    update.geometryChanged ||
    fields.some(
      (field) => update.startState.field(field, false) !== update.state.field(field, false),
    )
  );
}
