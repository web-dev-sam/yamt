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
export const WAVE_TILE_WIDTH_PX = WAVE_STEPS * WAVE_STEP_PX;
export const WAVE_TILE_HEIGHT_PX =
  WAVE_GAP_PX + WAVE_HALF_HEIGHT_PX + WAVE_HALF_HEIGHT_PX + WAVE_GAP_PX;

export function waveTile(): string {
  const top = WAVE_GAP_PX;
  const mid = WAVE_GAP_PX + WAVE_HALF_HEIGHT_PX;
  const bottom = mid + WAVE_HALF_HEIGHT_PX;
  const level = [top, mid, bottom, mid, top];
  const segments = Array.from({ length: WAVE_STEPS }, (_, step) => {
    const from = level[step] ?? mid;
    const to = level[step + 1] ?? mid;
    const crest = from === mid ? to : from;
    const x = step * WAVE_STEP_PX;
    return `Q${px(x + WAVE_STEP_PX * HALF)} ${px(crest)} ${px(x + WAVE_STEP_PX)} ${px(to)}`;
  });
  return [`M0 ${px(top)}`, ...segments].join(" ");
}

export function waveCenterY(lineHeight: number): number {
  return (lineHeight - WAVE_TILE_HEIGHT_PX) * HALF + WAVE_HALF_HEIGHT_PX + WAVE_GAP_PX;
}
