import "../theme.css";
import {
  RangeSetBuilder,
  type Extension,
  type Line,
  type Range,
  type StateField,
  type Text,
} from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";

import type { Chunk } from "../../ipc";
import type { ChunkSpan } from "./chunkField";
import { lineSpan } from "./lineSpan";
import type { Side } from "./side";
import { sideMarks } from "./sideMark";
import type { ChunkState } from "./status";
import { paneTone, type Tone } from "./tone";
import { sideWordDecorations } from "./words";

type Band = { readonly from: number; readonly to: number; readonly tone: Tone };

function pointEdge(line: Line, from: number): "above" | "below" {
  return line.from === from ? "above" : "below";
}

function bandDecorations(doc: Text, bands: readonly Band[]): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to, tone } of bands) {
    let line = doc.lineAt(from);
    if (from === to) {
      const edge = `chunk-point-${pointEdge(line, from)}`;
      builder.add(line.from, line.from, Decoration.line({ class: `chunk-marker-${tone} ${edge}` }));
      continue;
    }
    const band = Decoration.line({ class: `chunk-${tone} chunk-band` });
    builder.add(line.from, line.from, band);
    while (line.number < doc.lines && line.to + 1 < to) {
      line = doc.line(line.number + 1);
      builder.add(line.from, line.from, band);
    }
  }
  return builder.finish();
}

export function sideDecorations(
  statuses: StateField<readonly ChunkState[]>,
  side: Side,
): Extension {
  return EditorView.decorations.computeN([statuses], (state) => {
    const bands = state.field(statuses).flatMap(({ chunk, status }) => {
      const tone = paneTone(chunk, status, side);
      return tone === null ? [] : [{ chunk, ...lineSpan(state.doc, chunk[side]), tone }];
    });
    const tinted = bands.map(({ chunk }) => chunk);
    return [bandDecorations(state.doc, bands), sideWordDecorations(state.doc, tinted, side)];
  });
}

function focusLines(doc: Text, range: Chunk["local"] | Chunk["remote"]): Range<Decoration>[] {
  if (range.len === 0) {
    const { from } = lineSpan(doc, range);
    const line = doc.lineAt(from);
    const point = `chunk-focus-point-${pointEdge(line, from)}`;
    return [Decoration.line({ class: point }).range(line.from)];
  }
  const last = Math.min(range.start + range.len, doc.lines);
  return Array.from({ length: last - range.start }, (_, index) => {
    const number = range.start + 1 + index;
    const ends = [
      number === range.start + 1 ? " chunk-focus-first" : "",
      number === last ? " chunk-focus-last" : "",
    ];
    return Decoration.line({ class: `chunk-focus${ends.join("")}` }).range(doc.line(number).from);
  });
}

export function focusDecorations(
  statuses: StateField<readonly ChunkState[]>,
  side: Side,
): Extension {
  const marks = sideMarks[side];
  return [
    marks,
    EditorView.decorations.compute([marks, statuses], (state) => {
      const mark = state.field(marks);
      const focused =
        mark.kind === "change"
          ? state.field(statuses).find(({ chunk }) => chunk.id === mark.id)
          : undefined;
      if (focused === undefined) {
        return Decoration.none;
      }
      return Decoration.set(focusLines(state.doc, focused.chunk[side]));
    }),
  ];
}

export function centerDecorations(field: StateField<readonly ChunkSpan[]>): Extension {
  return EditorView.decorations.compute([field, "doc"], (state) =>
    bandDecorations(
      state.doc,
      state.field(field).flatMap(({ chunk, status, from, to }) => {
        const tone = paneTone(chunk, status, "center");
        return tone === null ? [] : [{ from, to, tone }];
      }),
    ),
  );
}
