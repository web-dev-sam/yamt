import "../theme.css";
import type { EditorView } from "@codemirror/view";
import chevronsLeftIcon from "~icons/lucide/chevrons-left?raw";
import chevronsRightIcon from "~icons/lucide/chevrons-right?raw";
import cornerLeftDownIcon from "~icons/lucide/corner-left-down?raw";
import cornerRightDownIcon from "~icons/lucide/corner-right-down?raw";
import xIcon from "~icons/lucide/x?raw";

import { bandPath, type Band } from "../../connectors";
import type { Chunk } from "../../ipc";
import type { ChunkRow, PaneViews } from "./geometry";
import type { Side } from "./side";
import { applyMode, isSideOpen, type ApplyMode } from "./status";
import { chunkTone, type Tone } from "./tone";

export type ChunkAction =
  | { readonly kind: "apply"; readonly chunk: Chunk; readonly side: Side }
  | { readonly kind: "ignore"; readonly chunk: Chunk; readonly side: Side };

type OnAction = (action: ChunkAction) => void;
type ToneBand = Band & { readonly tone: Tone };
type Arrow = { readonly top: number; readonly chunk: Chunk; readonly mode: ApplyMode };
type ArrowPane = {
  readonly view: EditorView;
  readonly side: Side;
  readonly arrows: readonly Arrow[];
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

function gapBands(rows: readonly ChunkRow[], side: Side): ToneBand[] {
  return rows
    .filter((row) => isSideOpen(row.chunk, row.status, side))
    .map((row) => ({
      left: side === "local" ? row.left : row.center,
      right: side === "local" ? row.center : row.right,
      tone: chunkTone(row.chunk, side),
    }));
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

function bandPaths(
  strip: SVGSVGElement,
  stripTop: number,
  panes: { readonly left: EditorView; readonly right: EditorView },
  bands: readonly ToneBand[],
): SVGPathElement[] {
  const leftShift = panes.left.documentTop - stripTop;
  const rightShift = panes.right.documentTop - stripTop;
  const height = strip.clientHeight;
  const paths = [];
  for (const band of bands) {
    const onLeft = { top: band.left.top + leftShift, bottom: band.left.bottom + leftShift };
    const onRight = { top: band.right.top + rightShift, bottom: band.right.bottom + rightShift };
    if (
      Math.min(onLeft.top, onRight.top) <= height &&
      Math.max(onLeft.bottom, onRight.bottom) >= 0
    ) {
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("class", `chunk-${band.tone} chunk-band`);
      path.setAttribute("d", bandPath({ left: onLeft, right: onRight }, strip.clientWidth));
      paths.push(path);
    }
  }
  return paths;
}

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

function actionButton(
  button: { x: number; lineHeight: number; icon: string; title: string },
  action: ChunkAction,
  onAction: OnAction,
): SVGGElement {
  const group = document.createElementNS(SVG_NS, "g");
  group.setAttribute("class", `chunk-action chunk-action-${action.kind}`);
  group.setAttribute("transform", `translate(${button.x} 0)`);
  const title = document.createElementNS(SVG_NS, "title");
  title.textContent = button.title;
  const hit = document.createElementNS(SVG_NS, "rect");
  hit.setAttribute("width", String(ACTION_WIDTH_PX));
  hit.setAttribute("height", String(button.lineHeight));
  group.append(title, hit, iconElement(button.icon, button.lineHeight));
  group.addEventListener("pointerdown", (event) => {
    if (event.button === 0) {
      onAction(action);
    }
  });
  return group;
}

function arrowGroups(
  strip: SVGSVGElement,
  stripTop: number,
  { view, side, arrows }: ArrowPane,
  onAction: OnAction,
): SVGGElement[] {
  const shift = view.documentTop - stripTop;
  const lineHeight = view.defaultLineHeight;
  const height = strip.clientHeight;
  const applyX = side === "local" ? 0 : strip.clientWidth - ACTION_WIDTH_PX;
  const ignoreX = side === "local" ? ACTION_WIDTH_PX : applyX - ACTION_WIDTH_PX;
  return arrows
    .filter(({ top }) => top + shift + lineHeight >= 0 && top + shift <= height)
    .map(({ top, chunk, mode }) => {
      const row = document.createElementNS(SVG_NS, "g");
      row.setAttribute("transform", `translate(0 ${top + shift})`);
      row.append(
        actionButton(
          { x: applyX, lineHeight, icon: APPLY_ICON[side][mode], title: APPLY_TITLE[mode] },
          { kind: "apply", chunk, side },
          onAction,
        ),
        actionButton(
          { x: ignoreX, lineHeight, icon: xIcon, title: "Ignore" },
          { kind: "ignore", chunk, side },
          onAction,
        ),
      );
      return row;
    });
}

function paintGap(
  strip: SVGSVGElement,
  panes: { readonly left: EditorView; readonly right: EditorView },
  { side, rows }: { readonly side: Side; readonly rows: readonly ChunkRow[] },
  onAction: OnAction,
): void {
  const stripTop = strip.getBoundingClientRect().top;
  const view = side === "local" ? panes.left : panes.right;
  strip.replaceChildren(
    ...bandPaths(strip, stripTop, panes, gapBands(rows, side)),
    ...arrowGroups(strip, stripTop, { view, side, arrows: gapArrows(rows, side) }, onAction),
  );
}

export function paintStrips(
  views: PaneViews,
  strips: readonly [SVGSVGElement, SVGSVGElement],
  rows: readonly ChunkRow[],
  onAction: OnAction,
): void {
  paintGap(strips[0], { left: views.left, right: views.center }, { side: "local", rows }, onAction);
  paintGap(
    strips[1],
    { left: views.center, right: views.right },
    { side: "remote", rows },
    onAction,
  );
}

export function keepEditorFocus(event: MouseEvent): void {
  event.preventDefault();
}
