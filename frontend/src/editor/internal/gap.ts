import { bandPath } from "../../connectors";
import type { Chunk } from "../../ipc";
import type { ChunkAction } from "./apply";
import { SIDE_PANE, type ChunkRow } from "./geometry";
import { modKeyName } from "./modClick";
import type { Side } from "./side";
import { applyMode, decidesOtherSide, isSideOpen, type ApplyMode } from "./status";
import { chunkTone, type Tone } from "./tone";

export type Arrow = {
  readonly top: number;
  readonly chunk: Chunk;
  readonly mode: ApplyMode;
  readonly otherWaits: boolean;
};
export type BandPaint = { readonly chunk: Chunk; readonly tone: Tone; readonly d: string };
export type ArrowTitles = Readonly<Record<ChunkAction["kind"], string>>;
export type ButtonLayout = {
  readonly applyX: number;
  readonly ignoreX: number;
  readonly lineHeight: number;
};
export type ArrowShape = Pick<Arrow, "mode" | "otherWaits"> & { readonly layout: ButtonLayout };

const APPLY_TITLE: Readonly<Record<ApplyMode, string>> = {
  replace: "Apply",
  append: "Apply after the other side",
};

export function crossesStrip(top: number, bottom: number, height: number): boolean {
  return top <= height && bottom >= 0;
}

export function gapArrows(rows: readonly ChunkRow[], side: Side): Arrow[] {
  return rows
    .filter((row) => isSideOpen(row.chunk, row.status, side))
    .map((row) => ({
      top: row[SIDE_PANE[side]].top,
      chunk: row.chunk,
      mode: applyMode(row.status, side),
      otherWaits: decidesOtherSide(row.chunk, row.status, side),
    }));
}

export function arrowTitles({ mode, otherWaits }: Arrow, platform: string): ArrowTitles {
  if (!otherWaits) {
    return { apply: APPLY_TITLE[mode], ignore: "Ignore" };
  }
  const click = `${modKeyName(platform)}+click`;
  return {
    apply: `${APPLY_TITLE[mode]}\n${click}: also ignore the other side`,
    ignore: `Ignore\n${click}: also take the other side`,
  };
}

export function keepsArrowRow(
  row: ArrowShape,
  { mode, otherWaits }: Pick<Arrow, "mode" | "otherWaits">,
  layout: ButtonLayout,
): boolean {
  return (
    row.mode === mode &&
    row.otherWaits === otherWaits &&
    row.layout.applyX === layout.applyX &&
    row.layout.ignoreX === layout.ignoreX &&
    row.layout.lineHeight === layout.lineHeight
  );
}

export function bandPaints(
  { rows, side }: { readonly rows: readonly ChunkRow[]; readonly side: Side },
  shifts: { readonly left: number; readonly right: number },
  size: { readonly width: number; readonly height: number },
): BandPaint[] {
  const paints = [];
  for (const row of rows) {
    if (isSideOpen(row.chunk, row.status, side)) {
      const left = side === "local" ? row.left : row.center;
      const right = side === "local" ? row.center : row.right;
      const onLeft = { top: left.top + shifts.left, bottom: left.bottom + shifts.left };
      const onRight = { top: right.top + shifts.right, bottom: right.bottom + shifts.right };
      const top = Math.min(onLeft.top, onRight.top);
      if (crossesStrip(top, Math.max(onLeft.bottom, onRight.bottom), size.height)) {
        const d = bandPath({ left: onLeft, right: onRight }, size.width);
        paints.push({ chunk: row.chunk, tone: chunkTone(row.chunk, side), d });
      }
    }
  }
  return paints;
}
