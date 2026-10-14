import { bandPath, waveCenterY, waveJoinPath } from "../../connectors";
import type { Chunk } from "../../ipc";
import type { ChunkAction } from "./apply";
import { SIDE_PANE, STRIP_PANES, type ChunkRow, type WaveRow } from "./geometry";
import { modKeyName } from "./modClick";
import type { Side } from "./side";
import { applyMode, decidesOtherSide, isSideOpen, type ApplyMode } from "./status";
import { chunkTone, type Tone } from "./tone";

export type Arrow = {
  readonly top: number;
  readonly chunk: Chunk;
  readonly mode: ApplyMode;
  readonly decidesOther: boolean;
};
export type BandPaint = { readonly chunk: Chunk; readonly tone: Tone; readonly d: string };
export type WavePaint = { readonly run: number; readonly d: string };
export type ArrowTitles = Readonly<Record<ChunkAction["kind"], string>>;
export type ButtonLayout = {
  readonly applyX: number;
  readonly ignoreX: number;
  readonly lineHeight: number;
};
export type ArrowShape = Pick<Arrow, "mode" | "decidesOther"> & { readonly layout: ButtonLayout };

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
      decidesOther: decidesOtherSide(row.chunk, row.status, side),
    }));
}

export function arrowTitles({ mode, decidesOther }: Arrow, platform: string): ArrowTitles {
  if (!decidesOther) {
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
  { mode, decidesOther }: Pick<Arrow, "mode" | "decidesOther">,
  layout: ButtonLayout,
): boolean {
  return (
    row.mode === mode &&
    row.decidesOther === decidesOther &&
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
  const panes = STRIP_PANES[side];
  const paints = [];
  for (const row of rows) {
    if (isSideOpen(row.chunk, row.status, side)) {
      const left = row[panes.left];
      const right = row[panes.right];
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

export function wavePaints(
  { waves, side }: { readonly waves: readonly WaveRow[]; readonly side: Side },
  shifts: { readonly left: number; readonly right: number },
  size: { readonly width: number; readonly height: number; readonly lineHeight: number },
): WavePaint[] {
  const center = waveCenterY(size.lineHeight);
  const panes = STRIP_PANES[side];
  const paints = [];
  for (const [run, wave] of waves.entries()) {
    const left = wave[panes.left];
    const right = wave[panes.right];
    if (left !== null && right !== null) {
      const onLeft = left + shifts.left;
      const onRight = right + shifts.right;
      const top = Math.min(onLeft, onRight);
      if (crossesStrip(top, Math.max(onLeft, onRight) + size.lineHeight, size.height)) {
        const join = { left: onLeft + center, right: onRight + center };
        paints.push({ run, d: waveJoinPath(join, size.width) });
      }
    }
  }
  return paints;
}
