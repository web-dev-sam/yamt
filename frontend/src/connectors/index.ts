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
