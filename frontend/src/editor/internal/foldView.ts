import {
  RangeSet,
  RangeSetBuilder,
  type EditorState,
  type Extension,
  type StateField,
} from "@codemirror/state";
import {
  Decoration,
  EditorView,
  GutterMarker,
  lineNumberMarkers,
  WidgetType,
  type DecorationSet,
} from "@codemirror/view";

import { waveCenterY, waveTile, WAVE_HOVER_STROKE_PX, WAVE_STROKE_PX } from "../../connectors";
import { MASK_PERIODS, WAVE_TILE_HEIGHT_PX, WAVE_TILE_WIDTH_PX } from "../../connectors";
import { Folding, FOLD_RUN_ATTRIBUTE, HOVER_CLASS } from "./folding";
import { displayed, type Fold } from "./foldRuns";
import { collapseSpec, foldFields, paneFolds, pushFolds, showNextStep, sideReveals } from "./folds";
import { waveDeletes, type FoldFields } from "./folds";
import type { Pane, PaneViews } from "./geometry";
import { LINE_HEIGHT_PX } from "./pane";
import { WavePhases, WAVE_PHASE_VARS, type WaveHosts } from "./wavePhase";

type FoldWiring = {
  readonly folds: FoldFields;
  readonly hovered: () => number | null;
  readonly views: () => PaneViews;
};

const WAVE_LABEL = "Show unchanged lines";
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

export function foldDecorations<P extends string>(
  folds: readonly Fold<P>[],
  pane: P,
): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  folds.forEach((fold, run) => {
    const hidden = displayed(fold, pane);
    if (hidden !== null) {
      // Inline, not `block: true`: vertical motion skips block widgets (@codemirror/view
      // posAtCoords), so the cursor could not stop on the wave line (plan §2 #63).
      builder.add(hidden.from, hidden.to, Decoration.replace({ widget: new FoldLine(run) }));
    }
  });
  return builder.finish();
}

function waveMarkers<P extends string>(
  folds: readonly Fold<P>[],
  pane: P,
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

// WebKitGTK draws a repeated mask tile at its width rounded to whole device pixels but places it from the
// unrounded width (plan §2 #64), so one tile holds MASK_PERIODS waves: `wavePhase` keeps that width whole
// CSS pixels, which are whole device pixels because WebKitGTK draws only at whole ratios (plan §3).
const MASK_WIDTH_PX = WAVE_TILE_WIDTH_PX * MASK_PERIODS;

function waveMask(strokePx: number): string {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${MASK_WIDTH_PX}' height='${WAVE_TILE_HEIGHT_PX}' ` +
    `viewBox='0 0 ${MASK_WIDTH_PX} ${WAVE_TILE_HEIGHT_PX}' preserveAspectRatio='none'>` +
    `<path d='${waveTile(MASK_PERIODS)}' fill='none' stroke='black' stroke-width='${strokePx}'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function maskStyle(strokePx: number): Readonly<Record<string, string>> {
  const image = waveMask(strokePx);
  return { maskImage: image, WebkitMaskImage: image };
}

const waveTop = waveCenterY(LINE_HEIGHT_PX) - WAVE_TILE_HEIGHT_PX * HALF;
const tile = {
  maskRepeat: "repeat-x",
  maskPosition: `var(${WAVE_PHASE_VARS.offset}, 0px) ${waveTop}px`,
  maskSize: `calc(var(${WAVE_PHASE_VARS.period}, ${WAVE_TILE_WIDTH_PX}px) * ${MASK_PERIODS}) ${WAVE_TILE_HEIGHT_PX}px`,
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
    ...maskStyle(WAVE_STROKE_PX),
  },
  [`.fold-wave.${HOVER_CLASS}`]: maskStyle(WAVE_HOVER_STROKE_PX),
});

export function paneFoldView<P extends string>(
  shown: {
    readonly field: StateField<unknown>;
    readonly folds: (state: EditorState) => readonly Fold<P>[];
  },
  pane: P,
  hovered: () => number | null,
): Extension {
  return [
    EditorView.decorations.compute([shown.field], (state) =>
      foldDecorations(shown.folds(state), pane),
    ),
    EditorView.atomicRanges.of((view) => foldDecorations(shown.folds(view.state), pane)),
    lineNumberMarkers.compute([shown.field], (state) =>
      waveMarkers(shown.folds(state), pane, hovered),
    ),
    waveTheme,
  ];
}

function foldView({ folds, hovered }: FoldWiring, pane: Pane): Extension {
  const field = pane === "center" ? folds.center : folds.sides;
  return paneFoldView({ field, folds: (state) => paneFolds(folds, pane, state) }, pane, hovered);
}

export function centerFolds(wiring: FoldWiring): Extension {
  const { folds, views } = wiring;
  return [
    folds.center,
    foldView(wiring, "center"),
    pushFolds(folds, views),
    waveDeletes(folds.center),
  ];
}

export function sideFolds(wiring: FoldWiring, pane: "left" | "right"): Extension {
  const { folds, views } = wiring;
  return [folds.sides, foldView(wiring, pane), sideReveals(folds, pane, () => views().center)];
}

export class Folds {
  readonly fields: FoldFields;
  readonly hovered = (): number | null => this.#folding.hovered();
  readonly #folding: Folding;
  readonly #phases: WavePhases;
  readonly #wiring: FoldWiring;

  constructor(runs: readonly Fold[], hosts: WaveHosts, views: () => PaneViews, collapsed: boolean) {
    const fields = foldFields(runs, collapsed);
    this.fields = fields;
    this.#wiring = { folds: fields, hovered: this.hovered, views };
    const all = [hosts.left, hosts.center, hosts.right, ...hosts.strips];
    this.#folding = new Folding(all, (run) => {
      const center = views().center;
      center.dispatch(showNextStep(center.state.field(fields.center), run));
    });
    this.#phases = new WavePhases(hosts, views);
  }

  setCollapsed(collapsed: boolean): void {
    const center = this.#wiring.views().center;
    center.dispatch(collapseSpec(this.fields.center, center.state, collapsed), {
      effects: center.scrollSnapshot(),
    });
  }

  center(): Extension {
    return centerFolds(this.#wiring);
  }

  side(pane: "left" | "right"): Extension {
    return sideFolds(this.#wiring, pane);
  }

  destroy(): void {
    this.#folding.destroy();
    this.#phases.destroy();
  }
}
