import type { StateField, Text } from "@codemirror/state";
import type { EditorView, ViewUpdate } from "@codemirror/view";

import type { Span } from "../../connectors";
import type { ChunkSpan } from "./chunkField";
import type { DocPos } from "./docPos";
import { lineSpan } from "./lineSpan";
import type { Side } from "./side";
import type { ChunkState } from "./status";

export type Pane = "left" | "center" | "right";
export const PANES = ["left", "center", "right"] as const satisfies readonly Pane[];
export type PaneViews = Readonly<Record<Pane, EditorView>>;
export type ChunkRow = Readonly<Record<Pane, Span>> & ChunkState;
export type WaveRow = Readonly<Record<Pane, number | null>>;

export const SIDE_PANE: Readonly<Record<Side, "left" | "right">> = {
  local: "left",
  remote: "right",
};

export const STRIP_PANES: Readonly<Record<Side, { readonly left: Pane; readonly right: Pane }>> = {
  local: { left: "left", right: "center" },
  remote: { left: "center", right: "right" },
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

export function waveRows(
  starts: Readonly<Record<Pane, readonly (DocPos | null)[]>>,
  blockTop: (pane: Pane, pos: DocPos) => number,
): WaveRow[] {
  function top(pane: Pane, run: number): number | null {
    const start = starts[pane][run] ?? null;
    return start === null ? null : blockTop(pane, start);
  }
  return starts.center.map((_, run) => ({
    left: top("left", run),
    center: top("center", run),
    right: top("right", run),
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
