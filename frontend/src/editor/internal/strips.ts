import "../theme.css";
import type { EditorView } from "@codemirror/view";

import { bandPath, type Band } from "../../connectors";
import type { Chunk } from "../../ipc";
import type { ChunkRow, PaneViews } from "./geometry";
import { sideChanged, type Side } from "./side";
import { canApply, isResolved } from "./status";
import { chunkTone, type Tone } from "./tone";

export type ChunkAction =
  | { readonly kind: "apply"; readonly chunk: Chunk; readonly side: Side }
  | { readonly kind: "dismiss"; readonly chunk: Chunk };

type OnAction = (action: ChunkAction) => void;
type ToneBand = Band & { readonly tone: Tone };
type Arrow = { readonly top: number; readonly chunk: Chunk };
type ArrowPane = {
  readonly view: EditorView;
  readonly side: Side;
  readonly arrows: readonly Arrow[];
};

const SVG_NS = "http://www.w3.org/2000/svg";
const ACTION_WIDTH_PX = 16;
const GLYPH_CENTER = 0.5;
const APPLY_GLYPH: Readonly<Record<Side, string>> = { local: "»", remote: "«" };

function gapBands(rows: readonly ChunkRow[], side: Side): ToneBand[] {
  return rows
    .filter((row) => sideChanged(row.chunk, side) && !isResolved(row.chunk, row.status))
    .map((row) => ({
      left: side === "local" ? row.left : row.center,
      right: side === "local" ? row.center : row.right,
      tone: chunkTone(row.chunk, side),
    }));
}

export function gapArrows(rows: readonly ChunkRow[], side: Side): Arrow[] {
  return rows
    .filter((row) => canApply(row.chunk, row.status, side))
    .map((row) => ({ top: (side === "local" ? row.left : row.right).top, chunk: row.chunk }));
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

function actionButton(
  button: { x: number; lineHeight: number; glyph: string; title: string },
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
  const glyph = document.createElementNS(SVG_NS, "text");
  glyph.setAttribute("x", String(ACTION_WIDTH_PX * GLYPH_CENTER));
  glyph.setAttribute("y", String(button.lineHeight * GLYPH_CENTER));
  glyph.textContent = button.glyph;
  group.append(title, hit, glyph);
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
  const dismissX = side === "local" ? ACTION_WIDTH_PX : applyX - ACTION_WIDTH_PX;
  return arrows
    .filter(({ top }) => top + shift + lineHeight >= 0 && top + shift <= height)
    .map(({ top, chunk }) => {
      const row = document.createElementNS(SVG_NS, "g");
      row.setAttribute("transform", `translate(0 ${top + shift})`);
      row.append(
        actionButton(
          { x: applyX, lineHeight, glyph: APPLY_GLYPH[side], title: "Apply" },
          { kind: "apply", chunk, side },
          onAction,
        ),
        actionButton(
          { x: dismissX, lineHeight, glyph: "×", title: "Ignore" },
          { kind: "dismiss", chunk },
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
