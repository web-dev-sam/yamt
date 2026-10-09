import "../theme.css";
import type { EditorView } from "@codemirror/view";

import { bandPath, type Band } from "../../connectors";
import type { ChunkRow, PaneViews } from "./geometry";
import { chunkTone, sideChanged, type Side, type Tone } from "./tone";

type ToneBand = Band & { readonly tone: Tone };

const SVG_NS = "http://www.w3.org/2000/svg";

function gapBands(rows: readonly ChunkRow[], side: Side): ToneBand[] {
  return rows
    .filter((row) => sideChanged(row.chunk, side))
    .map((row) => ({
      left: side === "local" ? row.left : row.center,
      right: side === "local" ? row.center : row.right,
      tone: chunkTone(row.chunk, side),
    }));
}

function paintGap(
  strip: SVGSVGElement,
  left: EditorView,
  right: EditorView,
  bands: readonly ToneBand[],
): void {
  const stripTop = strip.getBoundingClientRect().top;
  const leftShift = left.documentTop - stripTop;
  const rightShift = right.documentTop - stripTop;
  const height = strip.clientHeight;
  const width = strip.clientWidth;
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
      path.setAttribute("d", bandPath({ left: onLeft, right: onRight }, width));
      paths.push(path);
    }
  }
  strip.replaceChildren(...paths);
}

export function paintStrips(
  views: PaneViews,
  strips: readonly [SVGSVGElement, SVGSVGElement],
  rows: readonly ChunkRow[],
): void {
  paintGap(strips[0], views.left, views.center, gapBands(rows, "local"));
  paintGap(strips[1], views.center, views.right, gapBands(rows, "remote"));
}
