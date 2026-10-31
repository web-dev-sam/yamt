import {
  RangeSet,
  StateEffect,
  StateField,
  type EditorState,
  type Extension,
} from "@codemirror/state";
import { Decoration, EditorView, GutterMarker, gutterLineClass } from "@codemirror/view";

import type { Column, Difference, ThreadPlace } from "../../ipc";
import { placeSpans } from "./diffOrder";
import { joinSpans, type LineSpan } from "./foldRuns";

type ColumnTint = Readonly<Record<Column, readonly LineSpan[]>>;

const TINT_CLASS = "cm-thread-tint";

class TintMarker extends GutterMarker {
  override elementClass = TINT_CLASS;
}

const tintLine = Decoration.line({ class: TINT_CLASS });
const tintMarker = new TintMarker();

export const showTint = StateEffect.define<readonly LineSpan[]>();

const tintField = StateField.define<readonly LineSpan[]>({
  create: () => [],
  update: (spans, tr) => tr.effects.findLast((effect) => effect.is(showTint))?.value ?? spans,
});

export function tintOf(state: EditorState): readonly LineSpan[] {
  return state.field(tintField);
}

function lineStarts(state: EditorState): number[] {
  const { doc } = state;
  return tintOf(state).flatMap(({ start, len }) =>
    Array.from(
      { length: Math.max(0, Math.min(start + len, doc.lines) - start) },
      (_, index) => doc.line(start + index + 1).from,
    ),
  );
}

export const threadTint: Extension = [
  tintField,
  EditorView.decorations.compute(["doc", tintField], (state) =>
    Decoration.set(
      lineStarts(state).map((from) => tintLine.range(from)),
      true,
    ),
  ),
  gutterLineClass.compute(["doc", tintField], (state) =>
    RangeSet.of(
      lineStarts(state).map((from) => tintMarker.range(from)),
      true,
    ),
  ),
];

function mergedSpans(spans: readonly LineSpan[]): LineSpan[] {
  const out: LineSpan[] = [];
  for (const span of spans.toSorted((a, b) => a.start - b.start)) {
    const last = out.at(-1);
    const both = last === undefined ? null : joinSpans(last, span);
    if (both === null) {
      out.push(span);
    } else {
      out[out.length - 1] = both;
    }
  }
  return out;
}

/** Per column, the lines of all `places` as sorted spans that neither overlap nor touch. */
export function placesTint(
  differences: readonly Difference[],
  places: readonly ThreadPlace[],
): ColumnTint {
  const spans = places.map((place) => placeSpans(differences, place));
  return {
    left: mergedSpans(spans.flatMap(({ left }) => left)),
    right: mergedSpans(spans.flatMap(({ right }) => right)),
  };
}

export function sameSpans(a: readonly LineSpan[], b: readonly LineSpan[]): boolean {
  return (
    a.length === b.length &&
    a.every((span, index) => span.start === b[index]?.start && span.len === b[index].len)
  );
}
