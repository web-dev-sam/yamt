import "../theme.css";
import type { EditorView } from "@codemirror/view";
import chevronsLeftIcon from "~icons/lucide/chevrons-left?raw";
import chevronsRightIcon from "~icons/lucide/chevrons-right?raw";
import cornerLeftDownIcon from "~icons/lucide/corner-left-down?raw";
import cornerRightDownIcon from "~icons/lucide/corner-right-down?raw";
import xIcon from "~icons/lucide/x?raw";

import type { Chunk } from "../../ipc";
import type { ChunkAction } from "./apply";
import { bandPaints, crossesStrip, gapArrows, type Arrow, type BandPaint } from "./gap";
import type { ChunkRow, PaneViews } from "./geometry";
import type { Side } from "./side";
import type { ApplyMode } from "./status";

export type IconPress = {
  readonly kind: ChunkAction["kind"];
  readonly chunk: Chunk;
  readonly side: Side;
};

type OnPress = (press: IconPress, event: PointerEvent) => void;
type GapPanes = { readonly left: EditorView; readonly right: EditorView };
type ButtonLayout = {
  readonly applyX: number;
  readonly ignoreX: number;
  readonly lineHeight: number;
};
type PlacedArrow = { readonly arrow: Arrow; readonly y: number };
type ArrowPaint = {
  readonly placed: readonly PlacedArrow[];
  readonly layout: ButtonLayout;
  readonly onPress: OnPress;
};
type GapPaint = { readonly bands: readonly BandPaint[]; readonly arrows: ArrowPaint | null };
type ArrowRow = {
  readonly node: SVGGElement;
  readonly mode: ApplyMode;
  readonly layout: ButtonLayout;
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
const APPLY_TITLE: Readonly<Record<ApplyMode, string>> = {
  replace: "Apply",
  append: "Apply after the other side",
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
  { arrow, side }: { readonly arrow: Arrow; readonly side: Side },
  layout: ButtonLayout,
  onPress: OnPress,
): ArrowRow {
  const { chunk, mode } = arrow;
  const { applyX, ignoreX, lineHeight } = layout;
  const apply: IconPress = { kind: "apply", chunk, side };
  const ignore: IconPress = { kind: "ignore", chunk, side };
  const applyIcon = { icon: APPLY_ICON[side][mode], title: APPLY_TITLE[mode] };
  const applyButton = actionButton({ x: applyX, lineHeight, ...applyIcon }, apply, onPress);
  const ignoreTitle = { icon: xIcon, title: "Ignore" };
  const ignoreButton = actionButton({ x: ignoreX, lineHeight, ...ignoreTitle }, ignore, onPress);
  const node = document.createElementNS(SVG_NS, "g");
  node.append(applyButton, ignoreButton);
  return {
    node,
    mode,
    layout,
    buttons: [
      [applyButton, apply],
      [ignoreButton, ignore],
    ],
  };
}

function sameShape(row: ArrowRow, mode: ApplyMode, layout: ButtonLayout): boolean {
  return (
    row.mode === mode &&
    row.layout.applyX === layout.applyX &&
    row.layout.ignoreX === layout.ignoreX &&
    row.layout.lineHeight === layout.lineHeight
  );
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
  readonly #arrowLayer = document.createElementNS(SVG_NS, "g");
  readonly #bands = new Map<Chunk["id"], SVGPathElement>();
  readonly #arrows = new Map<Chunk["id"], ArrowRow>();

  constructor(strip: SVGSVGElement, side: Side, onPress: OnPress | null) {
    this.#strip = strip;
    this.#side = side;
    this.#onPress = onPress;
    strip.replaceChildren(this.#bandLayer, this.#arrowLayer);
    strip.addEventListener("mousedown", keepEditorFocus);
  }

  measure(panes: GapPanes, rows: readonly ChunkRow[]): GapPaint {
    const strip = this.#strip;
    const stripTop = strip.getBoundingClientRect().top;
    const size = { width: strip.clientWidth, height: strip.clientHeight };
    const shifts = {
      left: panes.left.documentTop - stripTop,
      right: panes.right.documentTop - stripTop,
    };
    const bands = bandPaints({ rows, side: this.#side }, shifts, size);
    if (this.#onPress === null) {
      return { bands, arrows: null };
    }
    const local = this.#side === "local";
    const shift = local ? shifts.left : shifts.right;
    const lineHeight = (local ? panes.left : panes.right).defaultLineHeight;
    const applyX = local ? 0 : size.width - ACTION_WIDTH_PX;
    const ignoreX = local ? ACTION_WIDTH_PX : applyX - ACTION_WIDTH_PX;
    const placed = gapArrows(rows, this.#side)
      .map((arrow) => ({ arrow, y: arrow.top + shift }))
      .filter(({ y }) => crossesStrip(y, y + lineHeight, size.height));
    const layout = { applyX, ignoreX, lineHeight };
    return { bands, arrows: { placed, layout, onPress: this.#onPress } };
  }

  paint({ bands, arrows }: GapPaint, covered: ChunkAction | null): void {
    this.#paintBands(bands);
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
      if (row === undefined || !sameShape(row, arrow.mode, layout)) {
        row?.node.remove();
        row = arrowRow({ arrow, side: this.#side }, layout, onPress);
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

  constructor(strips: readonly [SVGSVGElement, SVGSVGElement], onPress: OnPress | null) {
    this.#local = new GapStrip(strips[0], "local", onPress);
    this.#remote = new GapStrip(strips[1], "remote", onPress);
  }

  paint(views: PaneViews, rows: readonly ChunkRow[], covered: ChunkAction | null): void {
    const local = this.#local.measure({ left: views.left, right: views.center }, rows);
    const remote = this.#remote.measure({ left: views.center, right: views.right }, rows);
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
