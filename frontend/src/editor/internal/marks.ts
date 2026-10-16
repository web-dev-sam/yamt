import { forEachDiagnostic, type Diagnostic } from "@codemirror/lint";
import type { EditorState } from "@codemirror/state";

import type { Span } from "../../connectors";
import type { Chunk } from "../../ipc";
import type { ChunkRow, Pane } from "./geometry";
import type { Side } from "./side";
import { paneTone, type Tone } from "./tone";

export type MarkKind = Tone | "error" | "warning" | "info";

export type MarkTarget =
  | { readonly kind: "change"; readonly id: Chunk["id"] }
  | { readonly kind: "problem"; readonly diagnostic: Diagnostic };

export type MarkPlace = Span & { readonly kind: MarkKind; readonly target: MarkTarget };

export type ScrollerMetrics = {
  readonly scrollHeight: number;
  readonly clientHeight: number;
  readonly offsetWidth: number;
  readonly clientWidth: number;
  readonly paddingTop: number;
};

export type LaneBox = {
  readonly width: number;
  readonly height: number;
  readonly track: Span;
  readonly scrollHeight: number;
  readonly paddingTop: number;
};

export type Tick = {
  readonly top: number;
  readonly height: number;
  readonly kind: MarkKind;
  readonly target: MarkTarget;
};

// WebStorm's error-stripe geometry and layers (intellij-community EditorMarkupModelImpl.kt:
// scrollBarWidth 14, errorStripeMarkMinHeight 2, a click takes marks within twice that;
// HighlighterLayer ERROR > DiffDrawUtil.STRIPE_LAYER > WARNING).
const LANE_MIN_WIDTH_PX = 14;
const TICK_MIN_HEIGHT_PX = 2;
const PICK_DISTANCE_PX = 4;

const PAINT_ORDER: Readonly<Record<MarkKind, number>> = {
  info: 0,
  warning: 1,
  inserted: 2,
  modified: 2,
  deleted: 2,
  conflict: 2,
  error: 3,
};

const SEVERITY_KIND: Readonly<Record<Diagnostic["severity"], MarkKind>> = {
  error: "error",
  warning: "warning",
  info: "info",
  hint: "info",
};

const TINT_OF: Readonly<Record<Pane, Side | "center">> = {
  left: "local",
  center: "center",
  right: "remote",
};

export function changePlaces(rows: readonly ChunkRow[], pane: Pane): MarkPlace[] {
  return rows.flatMap((row) => {
    const kind = paneTone(row.chunk, row.status, TINT_OF[pane]);
    const target: MarkTarget = { kind: "change", id: row.chunk.id };
    return kind === null ? [] : [{ ...row[pane], kind, target }];
  });
}

export function problemPlaces(state: EditorState, blockAt: (pos: number) => Span): MarkPlace[] {
  const places: MarkPlace[] = [];
  forEachDiagnostic(state, (diagnostic, from, to) => {
    places.push({
      top: blockAt(from).top,
      bottom: blockAt(to).bottom,
      kind: SEVERITY_KIND[diagnostic.severity],
      target: { kind: "problem", diagnostic },
    });
  });
  return places;
}

export function laneBox(scroller: ScrollerMetrics, arrows: boolean): LaneBox {
  const scrollbar = scroller.offsetWidth - scroller.clientWidth;
  const arrow = arrows ? scrollbar : 0;
  return {
    width: Math.max(scrollbar, LANE_MIN_WIDTH_PX),
    height: scroller.clientHeight,
    track: { top: arrow, bottom: scroller.clientHeight - arrow },
    scrollHeight: scroller.scrollHeight,
    paddingTop: scroller.paddingTop,
  };
}

export function ticks(places: readonly MarkPlace[], lane: LaneBox): Tick[] {
  const { track } = lane;
  const length = Math.max(0, track.bottom - track.top);
  const scale = lane.scrollHeight <= lane.height ? 1 : length / lane.scrollHeight;
  return places
    .map(({ top, bottom, kind, target }) => {
      const height = Math.min(Math.max((bottom - top) * scale, TICK_MIN_HEIGHT_PX), length);
      const y = track.top + (lane.paddingTop + top) * scale;
      return { top: Math.max(track.top, Math.min(y, track.bottom - height)), height, kind, target };
    })
    .sort((a, b) => {
      const byLayer = PAINT_ORDER[a.kind] - PAINT_ORDER[b.kind];
      return byLayer === 0 ? a.top - b.top : byLayer;
    });
}

export function tickAt(shown: readonly Tick[], y: number): Tick | null {
  let nearest: Tick | null = null;
  for (const tick of shown) {
    const near = y >= tick.top - PICK_DISTANCE_PX && y <= tick.top + tick.height + PICK_DISTANCE_PX;
    if (near && (nearest === null || Math.abs(tick.top - y) <= Math.abs(nearest.top - y))) {
      nearest = tick;
    }
  }
  return nearest;
}
