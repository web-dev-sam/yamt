import type { StateField, Text } from "@codemirror/state";
import type { EditorView, ViewUpdate } from "@codemirror/view";

import { bandPath, type Span } from "../../connectors";
import type { Chunk } from "../../ipc";
import type { ChunkSpan } from "./chunkField";
import { lineSpan } from "./lineSpan";
import type { Side } from "./side";
import { applyMode, isSideOpen, type ApplyMode, type ChunkState } from "./status";
import { chunkTone, type Tone } from "./tone";

export type Pane = "left" | "center" | "right";
export type PaneViews = Readonly<Record<Pane, EditorView>>;
export type ChunkRow = Readonly<Record<Pane, Span>> & ChunkState;
export type Arrow = { readonly top: number; readonly chunk: Chunk; readonly mode: ApplyMode };
export type BandPaint = { readonly chunk: Chunk; readonly tone: Tone; readonly d: string };

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
  field: StateField<readonly ChunkSpan[]>,
): boolean {
  return (
    update.geometryChanged ||
    update.startState.field(field, false) !== update.state.field(field, false)
  );
}

export function crossesStrip(top: number, bottom: number, height: number): boolean {
  return top <= height && bottom >= 0;
}

export function gapArrows(rows: readonly ChunkRow[], side: Side): Arrow[] {
  return rows
    .filter((row) => isSideOpen(row.chunk, row.status, side))
    .map((row) => ({
      top: (side === "local" ? row.left : row.right).top,
      chunk: row.chunk,
      mode: applyMode(row.status, side),
    }));
}

export function bandPaints(
  { rows, side }: { readonly rows: readonly ChunkRow[]; readonly side: Side },
  shifts: { readonly left: number; readonly right: number },
  size: { readonly width: number; readonly height: number },
): BandPaint[] {
  const paints = [];
  for (const row of rows) {
    if (isSideOpen(row.chunk, row.status, side)) {
      const left = side === "local" ? row.left : row.center;
      const right = side === "local" ? row.center : row.right;
      const onLeft = { top: left.top + shifts.left, bottom: left.bottom + shifts.left };
      const onRight = { top: right.top + shifts.right, bottom: right.bottom + shifts.right };
      const top = Math.min(onLeft.top, onRight.top);
      if (crossesStrip(top, Math.max(onLeft.bottom, onRight.bottom), size.height)) {
        const d = bandPath({ left: onLeft, right: onRight }, size.width);
        paints.push({ chunk: row.chunk, tone: chunkTone(row.chunk, side), d });
      }
    }
  }
  return paints;
}
