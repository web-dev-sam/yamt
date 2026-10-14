import { RangeSet, RangeSetBuilder, type Extension, type StateField } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  GutterMarker,
  lineNumberMarkers,
  WidgetType,
  type DecorationSet,
} from "@codemirror/view";

import { waveCenterY, waveTile, WAVE_TILE_HEIGHT_PX, WAVE_TILE_WIDTH_PX } from "../../connectors";
import { FOLD_RUN_ATTRIBUTE, HOVER_CLASS } from "./folding";
import { displayed, type Fold } from "./foldRuns";
import type { Pane } from "./geometry";
import { LINE_HEIGHT_PX } from "./pane";

const WAVE_LABEL = "Show unchanged lines";
const THIN_STROKE_PX = 1;
const THICK_STROKE_PX = 2;
const HALF = 0.5;

class FoldLine extends WidgetType {
  readonly run: number;

  constructor(run: number) {
    super();
    this.run = run;
  }

  override eq(other: FoldLine): boolean {
    return other.run === this.run;
  }

  toDOM(): HTMLElement {
    const line = document.createElement("span");
    line.className = "fold-line";
    return line;
  }
}

class WaveMarker extends GutterMarker {
  override readonly elementClass = "fold-wave-cell";
  readonly run: number;
  readonly #hovered: () => number | null;

  constructor(run: number, hovered: () => number | null) {
    super();
    this.run = run;
    this.#hovered = hovered;
  }

  override eq(other: WaveMarker): boolean {
    return other.run === this.run;
  }

  override toDOM(): Node {
    const wave = document.createElement("div");
    wave.className = "fold-wave";
    wave.classList.toggle(HOVER_CLASS, this.#hovered() === this.run);
    wave.setAttribute(FOLD_RUN_ATTRIBUTE, String(this.run));
    wave.setAttribute("role", "button");
    wave.setAttribute("aria-label", WAVE_LABEL);
    return wave;
  }
}

export function foldDecorations(folds: readonly Fold[], pane: Pane): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  folds.forEach((fold, run) => {
    const hidden = displayed(fold, pane);
    if (hidden !== null) {
      builder.add(hidden.from, hidden.to, Decoration.replace({ widget: new FoldLine(run) }));
    }
  });
  return builder.finish();
}

function waveMarkers(
  folds: readonly Fold[],
  pane: Pane,
  hovered: () => number | null,
): RangeSet<GutterMarker> {
  const builder = new RangeSetBuilder<GutterMarker>();
  folds.forEach((fold, run) => {
    const hidden = displayed(fold, pane);
    if (hidden !== null) {
      builder.add(hidden.from, hidden.from, new WaveMarker(run, hovered));
    }
  });
  return builder.finish();
}

function waveMask(strokePx: number): string {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${WAVE_TILE_WIDTH_PX}' height='${WAVE_TILE_HEIGHT_PX}'>` +
    `<path d='${waveTile()}' fill='none' stroke='black' stroke-width='${strokePx}'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function maskStyle(strokePx: number): Readonly<Record<string, string>> {
  const image = waveMask(strokePx);
  return { maskImage: image, WebkitMaskImage: image };
}

const waveTop = waveCenterY(LINE_HEIGHT_PX) - WAVE_TILE_HEIGHT_PX * HALF;
const tile = {
  maskRepeat: "repeat-x",
  maskPosition: `0 ${waveTop}px`,
  maskSize: `${WAVE_TILE_WIDTH_PX}px ${WAVE_TILE_HEIGHT_PX}px`,
};

const waveTheme = EditorView.theme({
  ".cm-scroller": { containerType: "inline-size" },
  ".cm-gutter.cm-lineNumbers": { overflow: "visible" },
  ".fold-wave-cell": { position: "relative" },
  ".fold-wave": {
    position: "absolute",
    left: "0",
    top: "0",
    width: "100cqi",
    height: "100%",
    cursor: "pointer",
    backgroundColor: "var(--color-diff-wave)",
    ...tile,
    WebkitMaskRepeat: tile.maskRepeat,
    WebkitMaskPosition: tile.maskPosition,
    WebkitMaskSize: tile.maskSize,
    ...maskStyle(THIN_STROKE_PX),
  },
  [`.fold-wave.${HOVER_CLASS}`]: maskStyle(THICK_STROKE_PX),
});

export function foldView(
  field: StateField<readonly Fold[]>,
  pane: Pane,
  hovered: () => number | null,
): Extension {
  return [
    EditorView.decorations.compute([field], (state) => foldDecorations(state.field(field), pane)),
    EditorView.atomicRanges.of((view) => foldDecorations(view.state.field(field), pane)),
    lineNumberMarkers.compute([field], (state) => waveMarkers(state.field(field), pane, hovered)),
    waveTheme,
  ];
}
