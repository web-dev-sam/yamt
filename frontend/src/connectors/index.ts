export type Span = { readonly top: number; readonly bottom: number };
export type Band = { readonly left: Span; readonly right: Span };

const CONTROL_X = 0.5;
const DECIMALS = 2;

function px(n: number): string {
  return String(Number(n.toFixed(DECIMALS)));
}

export function bandPath(band: Band, width: number): string {
  const { left, right } = band;
  const w = px(width);
  const mid = px(width * CONTROL_X);
  return [
    `M0 ${px(left.top)}`,
    `C${mid} ${px(left.top)} ${mid} ${px(right.top)} ${w} ${px(right.top)}`,
    `L${w} ${px(right.bottom)}`,
    `C${mid} ${px(right.bottom)} ${mid} ${px(left.bottom)} 0 ${px(left.bottom)}`,
    "Z",
  ].join(" ");
}

const WAVE_STEP_PX = 5;
const WAVE_HALF_HEIGHT_PX = 3;
const WAVE_GAP_PX = 1;
const WAVE_STEPS = 4;
const HALF = 0.5;
export const WAVE_STROKE_PX = 1;
export const WAVE_HOVER_STROKE_PX = 2;
export const WAVE_TILE_WIDTH_PX = WAVE_STEPS * WAVE_STEP_PX;
export const WAVE_TILE_HEIGHT_PX =
  WAVE_GAP_PX + WAVE_HALF_HEIGHT_PX + WAVE_HALF_HEIGHT_PX + WAVE_GAP_PX;
const WAVE_UP_STEPS = 3;
export const WAVE_DOWN_X = WAVE_STEP_PX;
export const WAVE_UP_X = WAVE_UP_STEPS * WAVE_STEP_PX;

export type WaveEnds =
  | { readonly kind: "leaves"; readonly at: number }
  | { readonly kind: "enters"; readonly at: number }
  | { readonly kind: "through"; readonly enters: number; readonly leaves: number };
export type WavePhase = { readonly offset: number; readonly period: number };

function mod(n: number, period: number): number {
  return ((n % period) + period) % period;
}

function pinned(x: number, tileX: number, period: number): WavePhase {
  return { offset: mod(x - (tileX * period) / WAVE_TILE_WIDTH_PX, period), period };
}

export function wavePhase(waveLeft: number, ends: WaveEnds): WavePhase {
  switch (ends.kind) {
    case "leaves":
      return pinned(ends.at - waveLeft, WAVE_DOWN_X, WAVE_TILE_WIDTH_PX);
    case "enters":
      return pinned(ends.at - waveLeft, WAVE_UP_X, WAVE_TILE_WIDTH_PX);
    case "through": {
      const span = ends.leaves - ends.enters;
      if (span <= 0) {
        return pinned(ends.enters - waveLeft, WAVE_UP_X, WAVE_TILE_WIDTH_PX);
      }
      const waves = Math.round(span / WAVE_TILE_WIDTH_PX - HALF);
      return pinned(ends.enters - waveLeft, WAVE_UP_X, span / (waves + HALF));
    }
  }
}

export function waveTile(periods: number): string {
  const top = WAVE_GAP_PX;
  const mid = WAVE_GAP_PX + WAVE_HALF_HEIGHT_PX;
  const bottom = mid + WAVE_HALF_HEIGHT_PX;
  const level = [top, mid, bottom, mid, top];
  const segments = Array.from({ length: WAVE_STEPS * periods }, (_, step) => {
    const from = level[step % WAVE_STEPS] ?? mid;
    const to = level[(step % WAVE_STEPS) + 1] ?? mid;
    const crest = from === mid ? to : from;
    const x = step * WAVE_STEP_PX;
    return `Q${px(x + WAVE_STEP_PX * HALF)} ${px(crest)} ${px(x + WAVE_STEP_PX)} ${px(to)}`;
  });
  return [`M0 ${px(top)}`, ...segments].join(" ");
}

export function waveCenterY(lineHeight: number): number {
  return (lineHeight - WAVE_TILE_HEIGHT_PX) * HALF + WAVE_HALF_HEIGHT_PX + WAVE_GAP_PX;
}

const LEVEL_SLOPE = 0.2;
const LEVEL_WIDE_STEPS = 5;
const EIGHTH = 0.125;
const ONE_AND_HALF = 1.5;
const DOUBLE = 2;
const TWO_AND_HALF = 2.5;
const QUADRUPLE = 4;

type Point = readonly [x: number, y: number];

function curve(command: "Q" | "C", points: readonly Point[]): string {
  return command + points.map(([x, y]) => `${px(x)} ${px(y)}`).join(" ");
}

function levelJoin(y1: number, y2: number, width: number): string[] {
  const s = WAVE_STEP_PX;
  const h = WAVE_HALF_HEIGHT_PX;
  const midX = width * HALF;
  const midY = (y1 + y2) * HALF;
  if (width <= LEVEL_WIDE_STEPS * s) {
    return [
      curve("Q", [
        [midX, midY + DOUBLE * h],
        [width, y2],
      ]),
    ];
  }
  return [
    curve("Q", [
      [HALF * s, y1 + h],
      [s, y1 + h],
    ]),
    curve("Q", [
      [ONE_AND_HALF * s, y1 + h],
      [DOUBLE * s, midY],
    ]),
    curve("Q", [
      [TWO_AND_HALF * s, midY - h],
      [midX, midY - h],
    ]),
    curve("Q", [
      [width - TWO_AND_HALF * s, midY - h],
      [width - DOUBLE * s, midY],
    ]),
    curve("Q", [
      [width - ONE_AND_HALF * s, y2 + h],
      [width - s, y2 + h],
    ]),
    curve("Q", [
      [width - HALF * s, y2 + h],
      [width, y2],
    ]),
  ];
}

function slopedJoin(y1: number, y2: number, width: number): string[] {
  const s = WAVE_STEP_PX;
  const h = WAVE_HALF_HEIGHT_PX;
  if (y1 > y2) {
    const x = EIGHTH * s;
    return [
      curve("C", [
        [x, y1 + EIGHTH * h],
        [x, y1 + HALF * h],
        [HALF * s, y1 + HALF * h],
      ]),
      curve("C", [
        [width - DOUBLE * s, y1 + HALF * h],
        [width - DOUBLE * s, y2 + QUADRUPLE * h],
        [width, y2],
      ]),
    ];
  }
  const x = width - EIGHTH * s;
  return [
    curve("C", [
      [DOUBLE * s, y1 + QUADRUPLE * h],
      [DOUBLE * s, y2 + HALF * h],
      [width - HALF * s, y2 + HALF * h],
    ]),
    curve("C", [
      [x, y2 + HALF * h],
      [x, y2 + EIGHTH * h],
      [width, y2],
    ]),
  ];
}

export function waveJoinPath(join: { left: number; right: number }, width: number): string {
  const { left, right } = join;
  const level = Math.abs(right - left) / width < LEVEL_SLOPE;
  const segments = level ? levelJoin(left, right, width) : slopedJoin(left, right, width);
  return [`M0 ${px(left)}`, ...segments].join(" ");
}
