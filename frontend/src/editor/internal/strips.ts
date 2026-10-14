import "../theme.css";
import type { EditorView } from "@codemirror/view";
import chevronsLeftIcon from "~icons/lucide/chevrons-left?raw";
import chevronsRightIcon from "~icons/lucide/chevrons-right?raw";
import cornerLeftDownIcon from "~icons/lucide/corner-left-down?raw";
import cornerRightDownIcon from "~icons/lucide/corner-right-down?raw";
import xIcon from "~icons/lucide/x?raw";

import type { Chunk } from "../../ipc";
import type { ChunkAction } from "./apply";
import {
  arrowTitles,
  bandPaints,
  crossesStrip,
  gapArrows,
  keepsArrowRow,
  type Arrow,
  type ArrowShape,
  type BandPaint,
  type ButtonLayout,
  wavePaints,
  type WavePaint,
} from "./gap";
import { SIDE_PANE, type ChunkRow, type PaneViews, type WaveRow } from "./geometry";
import { LINE_HEIGHT_PX } from "./pane";
import type { Side } from "./side";
import type { ApplyMode } from "./status";
import { StripWaves } from "./stripWaves";

export type IconPress = {
  readonly kind: ChunkAction["kind"];
  readonly chunk: Chunk;
  readonly side: Side;
};

type OnPress = (press: IconPress, event: PointerEvent) => void;
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
type ArrowRow = ArrowShape & {
  readonly node: SVGGElement;
  readonly buttons: readonly (readonly [SVGGElement, IconPress])[];
};

const SVG_NS = "http://www.w3.org/2000/svg";
const ACTION_WIDTH_PX = 16;
const ICON_PX = 14;
const HALF = 0.5;
const APPLY_ICON: Readonly<Record<Side, Readonly<Record<ApplyMode, string>>>> = {
  local: { replace: chevronsRightIcon, append: cornerRightDownIcon },
  remote: { replace: chevronsLeftIcon, append: cornerLeftDownIcon },
};
const parsedIcons = new Map<string, SVGSVGElement>();

function parsedIcon(markup: string): SVGSVGElement {
  const cached = parsedIcons.get(markup);
  if (cached !== undefined) {
    return cached;
  }
  const holder = document.createElementNS(SVG_NS, "g");
  holder.innerHTML = markup;
  const icon = holder.firstElementChild;
  if (!(icon instanceof SVGSVGElement)) {
    throw new Error("icon markup is not an <svg>");
  }
  parsedIcons.set(markup, icon);
  return icon;
}

function iconElement(markup: string, lineHeight: number): SVGSVGElement {
  const icon = document.importNode(parsedIcon(markup), true);
  icon.setAttribute("x", String((ACTION_WIDTH_PX - ICON_PX) * HALF));
  icon.setAttribute("y", String((lineHeight - ICON_PX) * HALF));
  icon.setAttribute("width", String(ICON_PX));
  icon.setAttribute("height", String(ICON_PX));
  return icon;
}

function isCovered(covered: ChunkAction | null, press: IconPress): boolean {
  return (
    covered !== null &&
    covered.kind === press.kind &&
    covered.side === press.side &&
    covered.chunks.some((chunk) => chunk.id === press.chunk.id)
  );
}

function actionButton(
  button: { x: number; lineHeight: number; icon: string; title: string },
  press: IconPress,
  onPress: OnPress,
): SVGGElement {
  const group = document.createElementNS(SVG_NS, "g");
  group.setAttribute("class", `chunk-action chunk-action-${press.kind}`);
  group.setAttribute("transform", `translate(${button.x} 0)`);
  const title = document.createElementNS(SVG_NS, "title");
  title.textContent = button.title;
  const hit = document.createElementNS(SVG_NS, "rect");
  hit.setAttribute("width", String(ACTION_WIDTH_PX));
  hit.setAttribute("height", String(button.lineHeight));
  group.append(title, hit, iconElement(button.icon, button.lineHeight));
  group.addEventListener("pointerdown", (event) => {
    if (event.button === 0) {
      onPress(press, event);
    }
  });
  return group;
}

function arrowRow(
  {
    arrow,
    side,
    platform,
  }: { readonly arrow: Arrow; readonly side: Side; readonly platform: string },
  layout: ButtonLayout,
  onPress: OnPress,
): ArrowRow {
  const { chunk, mode, decidesOther } = arrow;
  const { applyX, ignoreX, lineHeight } = layout;
  const titles = arrowTitles(arrow, platform);
  const apply: IconPress = { kind: "apply", chunk, side };
  const ignore: IconPress = { kind: "ignore", chunk, side };
  const applyIcon = { icon: APPLY_ICON[side][mode], title: titles.apply };
  const applyButton = actionButton({ x: applyX, lineHeight, ...applyIcon }, apply, onPress);
  const ignoreIcon = { icon: xIcon, title: titles.ignore };
  const ignoreButton = actionButton({ x: ignoreX, lineHeight, ...ignoreIcon }, ignore, onPress);
  const node = document.createElementNS(SVG_NS, "g");
  node.append(applyButton, ignoreButton);
  return {
    node,
    mode,
    decidesOther,
    layout,
    buttons: [
      [applyButton, apply],
      [ignoreButton, ignore],
    ],
  };
}

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

function dropMissing<T>(
  nodes: Map<Chunk["id"], T>,
  keptIds: ReadonlySet<Chunk["id"]>,
  remove: (node: T) => void,
): void {
  for (const [id, node] of nodes) {
    if (!keptIds.has(id)) {
      remove(node);
      nodes.delete(id);
    }
  }
}

class GapStrip {
  readonly #strip: SVGSVGElement;
  readonly #side: Side;
  readonly #onPress: OnPress | null;
  readonly #bandLayer = document.createElementNS(SVG_NS, "g");
  readonly #waves: StripWaves;
  readonly #arrowLayer = document.createElementNS(SVG_NS, "g");
  readonly #bands = new Map<Chunk["id"], SVGPathElement>();
  readonly #arrows = new Map<Chunk["id"], ArrowRow>();
  readonly #platform = navigator.platform;

  constructor(strip: SVGSVGElement, side: Side, onPress: OnPress | null, waves: StripWaves) {
    this.#strip = strip;
    this.#side = side;
    this.#onPress = onPress;
    this.#waves = waves;
    strip.replaceChildren(this.#bandLayer, this.#waves.layer, this.#arrowLayer);
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
    this.#waves.paint(waves);
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
    this.#local = new GapStrip(strips[0], "local", onPress, new StripWaves(hovered));
    this.#remote = new GapStrip(strips[1], "remote", onPress, new StripWaves(hovered));
  }

  paint(views: PaneViews, layout: StripLayout, covered: ChunkAction | null): void {
    const local = this.#local.measure({ left: views.left, right: views.center }, layout);
    const remote = this.#remote.measure({ left: views.center, right: views.right }, layout);
    this.#local.paint(local, covered);
    this.#remote.paint(remote, covered);
  }

  destroy(): void {
    this.#local.destroy();
    this.#remote.destroy();
  }
}

function keepEditorFocus(event: MouseEvent): void {
  event.preventDefault();
}
