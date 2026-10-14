import "../theme.css";
import type { EditorView } from "@codemirror/view";

import { WAVE_HOVER_STROKE_PX, WAVE_STROKE_PX } from "../../connectors";
import type { Chunk } from "../../ipc";
import type { ChunkAction } from "./apply";
import { FOLD_RUN_ATTRIBUTE, HOVER_CLASS } from "./folding";
import {
  bandPaints,
  crossesStrip,
  gapArrows,
  keepsArrowRow,
  type Arrow,
  type BandPaint,
  type ButtonLayout,
  wavePaints,
  type WavePaint,
} from "./gap";
import { SIDE_PANE, STRIP_PANES, type ChunkRow, type PaneViews, type WaveRow } from "./geometry";
import { LINE_HEIGHT_PX } from "./pane";
import type { Side } from "./side";
import { ACTION_WIDTH_PX, arrowRow, isCovered, type ArrowRow, type OnPress } from "./stripIcons";

export type { IconPress } from "./stripIcons";

type StripPair = readonly [SVGSVGElement, SVGSVGElement];
type GapPanes = { readonly left: EditorView; readonly right: EditorView };
type PlacedArrow = { readonly arrow: Arrow; readonly y: number };
type ArrowPaint = {
  readonly placed: readonly PlacedArrow[];
  readonly layout: ButtonLayout;
  readonly onPress: OnPress;
};
type GapPaint = {
  readonly bands: readonly BandPaint[];
  readonly waves: readonly WavePaint[];
  readonly arrows: ArrowPaint | null;
};
type StripLayout = { readonly rows: readonly ChunkRow[]; readonly waves: readonly WaveRow[] };

const SVG_NS = "http://www.w3.org/2000/svg";
const WAVE_PATH_CLASSES = ["strip-wave-hit", "strip-wave-line"] as const;

function placeInOrder(parent: SVGGElement, nodes: readonly Element[]): void {
  let next = parent.firstElementChild;
  for (const node of nodes) {
    if (node === next) {
      next = node.nextElementSibling;
    } else {
      parent.insertBefore(node, next);
    }
  }
}

function dropMissing<K, T>(
  nodes: Map<K, T>,
  keptKeys: ReadonlySet<K>,
  remove: (node: T) => void,
): void {
  for (const [key, node] of nodes) {
    if (!keptKeys.has(key)) {
      remove(node);
      nodes.delete(key);
    }
  }
}

function waveNode(run: number, hovered: number | null): SVGGElement {
  const group = document.createElementNS(SVG_NS, "g");
  group.setAttribute(FOLD_RUN_ATTRIBUTE, String(run));
  group.classList.toggle(HOVER_CLASS, run === hovered);
  for (const name of WAVE_PATH_CLASSES) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("class", name);
    group.append(path);
  }
  return group;
}

class GapStrip {
  readonly #strip: SVGSVGElement;
  readonly #side: Side;
  readonly #onPress: OnPress | null;
  readonly #hovered: () => number | null;
  readonly #bandLayer = document.createElementNS(SVG_NS, "g");
  readonly #waveLayer = document.createElementNS(SVG_NS, "g");
  readonly #arrowLayer = document.createElementNS(SVG_NS, "g");
  readonly #bands = new Map<Chunk["id"], SVGPathElement>();
  readonly #waves = new Map<number, SVGGElement>();
  readonly #arrows = new Map<Chunk["id"], ArrowRow>();
  readonly #platform = navigator.platform;

  constructor(
    strip: SVGSVGElement,
    side: Side,
    onPress: OnPress | null,
    hovered: () => number | null,
  ) {
    this.#strip = strip;
    this.#side = side;
    this.#onPress = onPress;
    this.#hovered = hovered;
    this.#waveLayer.style.setProperty("--strip-wave-hit", `${LINE_HEIGHT_PX}px`);
    this.#waveLayer.style.setProperty("--strip-wave-stroke", `${WAVE_STROKE_PX}px`);
    this.#waveLayer.style.setProperty("--strip-wave-hover-stroke", `${WAVE_HOVER_STROKE_PX}px`);
    strip.replaceChildren(this.#bandLayer, this.#waveLayer, this.#arrowLayer);
    strip.addEventListener("mousedown", keepEditorFocus);
  }

  measure(panes: GapPanes, { rows, waves: waveRows }: StripLayout): GapPaint {
    const strip = this.#strip;
    const stripTop = strip.getBoundingClientRect().top;
    const size = { width: strip.clientWidth, height: strip.clientHeight };
    const shifts = {
      left: panes.left.documentTop - stripTop,
      right: panes.right.documentTop - stripTop,
    };
    const bands = bandPaints({ rows, side: this.#side }, shifts, size);
    const waveSize = { ...size, lineHeight: LINE_HEIGHT_PX };
    const waves = wavePaints({ waves: waveRows, side: this.#side }, shifts, waveSize);
    if (this.#onPress === null) {
      return { bands, waves, arrows: null };
    }
    const local = this.#side === "local";
    const pane = SIDE_PANE[this.#side];
    const shift = shifts[pane];
    const lineHeight = panes[pane].defaultLineHeight;
    const applyX = local ? 0 : size.width - ACTION_WIDTH_PX;
    const ignoreX = local ? ACTION_WIDTH_PX : applyX - ACTION_WIDTH_PX;
    const placed = gapArrows(rows, this.#side)
      .map((arrow) => ({ arrow, y: arrow.top + shift }))
      .filter(({ y }) => crossesStrip(y, y + lineHeight, size.height));
    const layout = { applyX, ignoreX, lineHeight };
    return { bands, waves, arrows: { placed, layout, onPress: this.#onPress } };
  }

  paint({ bands, waves, arrows }: GapPaint, covered: ChunkAction | null): void {
    this.#paintBands(bands);
    this.#paintWaves(waves);
    if (arrows !== null) {
      this.#paintArrows(arrows, covered);
    }
  }

  #paintBands(paints: readonly BandPaint[]): void {
    dropMissing(this.#bands, new Set(paints.map(({ chunk }) => chunk.id)), (path) => {
      path.remove();
    });
    const nodes = paints.map(({ chunk, tone, d }) => {
      let path = this.#bands.get(chunk.id);
      if (path === undefined) {
        path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("class", `chunk-${tone} chunk-band`);
        this.#bands.set(chunk.id, path);
      }
      path.setAttribute("d", d);
      return path;
    });
    placeInOrder(this.#bandLayer, nodes);
  }

  #paintWaves(paints: readonly WavePaint[]): void {
    dropMissing(this.#waves, new Set(paints.map(({ run }) => run)), (group) => {
      group.remove();
    });
    for (const { run, d } of paints) {
      let group = this.#waves.get(run);
      if (group === undefined) {
        group = waveNode(run, this.#hovered());
        this.#waves.set(run, group);
        this.#waveLayer.append(group);
      }
      for (const path of group.children) {
        path.setAttribute("d", d);
      }
    }
  }

  #paintArrows({ placed, layout, onPress }: ArrowPaint, covered: ChunkAction | null): void {
    dropMissing(this.#arrows, new Set(placed.map(({ arrow }) => arrow.chunk.id)), (row) => {
      row.node.remove();
    });
    const nodes = placed.map(({ arrow, y }) => {
      let row = this.#arrows.get(arrow.chunk.id);
      if (row === undefined || !keepsArrowRow(row, arrow, layout)) {
        row?.node.remove();
        row = arrowRow({ arrow, side: this.#side, platform: this.#platform }, layout, onPress);
        this.#arrows.set(arrow.chunk.id, row);
      }
      row.node.setAttribute("transform", `translate(0 ${y})`);
      for (const [button, press] of row.buttons) {
        button.classList.toggle("chunk-action-covered", isCovered(covered, press));
      }
      return row.node;
    });
    placeInOrder(this.#arrowLayer, nodes);
  }

  destroy(): void {
    this.#strip.removeEventListener("mousedown", keepEditorFocus);
    this.#strip.replaceChildren();
  }
}

export class Strips {
  readonly #local: GapStrip;
  readonly #remote: GapStrip;

  constructor(strips: StripPair, onPress: OnPress | null, hovered: () => number | null) {
    this.#local = new GapStrip(strips[0], "local", onPress, hovered);
    this.#remote = new GapStrip(strips[1], "remote", onPress, hovered);
  }

  paint(views: PaneViews, layout: StripLayout, covered: ChunkAction | null): void {
    const local = this.#local.measure(stripViews(views, "local"), layout);
    const remote = this.#remote.measure(stripViews(views, "remote"), layout);
    this.#local.paint(local, covered);
    this.#remote.paint(remote, covered);
  }

  destroy(): void {
    this.#local.destroy();
    this.#remote.destroy();
  }
}

function stripViews(views: PaneViews, side: Side): GapPanes {
  const panes = STRIP_PANES[side];
  return { left: views[panes.left], right: views[panes.right] };
}

function keepEditorFocus(event: MouseEvent): void {
  event.preventDefault();
}
