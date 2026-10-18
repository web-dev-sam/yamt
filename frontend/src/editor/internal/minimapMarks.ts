import { forEachDiagnostic, type Diagnostic } from "@codemirror/lint";
import type { EditorState } from "@codemirror/state";

import type { Span } from "../../connectors";
import type { ChunkRow } from "./geometry";
import { rowTop, type Box, type MinimapLayout } from "./minimapLayout";
import { LINE_HEIGHT_PX } from "./pane";
import { paneTone, type Tone } from "./tone";

type EdgeKind = Tone | "error" | "warning";

export type EdgeMark = { readonly top: number; readonly bottom: number; readonly kind: EdgeKind };

type MarkBox = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly kind: EdgeKind;
};

const MARK_WIDTH_CSS_PX = 4;
const MARK_INSET_CSS_PX = 1;
const MARK_MIN_HEIGHT_CSS_PX = 4;
const HALVES = 2;

const SEVERITY_EDGE: Readonly<Record<Diagnostic["severity"], "error" | "warning" | null>> = {
  error: "error",
  warning: "warning",
  info: null,
  hint: null,
};

export function changeMarks(rows: readonly ChunkRow[]): EdgeMark[] {
  return rows.flatMap(({ chunk, status, center }) => {
    const kind = paneTone(chunk, status, "center");
    return kind === null ? [] : [{ top: center.top, bottom: center.bottom, kind }];
  });
}

export function problemMarks(state: EditorState, blockAt: (pos: number) => Span): EdgeMark[] {
  const warnings: EdgeMark[] = [];
  const errors: EdgeMark[] = [];
  forEachDiagnostic(state, ({ severity }, from, to) => {
    const kind = SEVERITY_EDGE[severity];
    if (kind !== null) {
      (kind === "error" ? errors : warnings).push({
        top: blockAt(from).top,
        bottom: blockAt(to).bottom,
        kind,
      });
    }
  });
  return [...warnings, ...errors];
}

export function markBoxes(marks: readonly EdgeMark[], layout: MinimapLayout, edge: Box): MarkBox[] {
  const { pixelRatio, height } = layout.input;
  const canvasHeight = Math.floor(pixelRatio * height);
  const x = edge.x + Math.round(MARK_INSET_CSS_PX * pixelRatio);
  const width = Math.round(MARK_WIDTH_CSS_PX * pixelRatio);
  const minHeight = Math.round(MARK_MIN_HEIGHT_CSS_PX * pixelRatio);
  const first = (layout.startRow - 1) * LINE_HEIGHT_PX;
  const last = layout.endRow * LINE_HEIGHT_PX;
  return marks
    .filter(({ top, bottom }) => bottom >= first && top <= last)
    .map(({ top, bottom, kind }) => {
      const from = Math.max(0, rowTop(layout, 1 + top / LINE_HEIGHT_PX));
      const to = Math.min(canvasHeight, rowTop(layout, 1 + bottom / LINE_HEIGHT_PX));
      const boxHeight = Math.max(to - from, minHeight);
      const centred = (from + to - boxHeight) / HALVES;
      const y = Math.round(Math.min(Math.max(0, centred), canvasHeight - boxHeight));
      return { x, y, width, height: Math.round(boxHeight), kind };
    });
}
