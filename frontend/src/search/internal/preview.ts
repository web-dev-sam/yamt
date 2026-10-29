import type { LineHit } from "./match";

export type Preview = { readonly before: string; readonly match: string; readonly after: string };

const BEFORE_CHARS = 26;
const AFTER_CHARS = 250;
const CUT_MARK = "…";
const LOW_SURROGATE = /^[\uDC00-\uDFFF]/;
const HIGH_SURROGATE = /[\uD800-\uDBFF]$/;

function beforeOf(lineText: string, from: number): string {
  const before = lineText.slice(0, from).trimStart();
  if (before.length <= BEFORE_CHARS) {
    return before;
  }
  return `${CUT_MARK}${before.slice(-BEFORE_CHARS).replace(LOW_SURROGATE, "")}`;
}

function afterOf(lineText: string, to: number): string {
  if (lineText.length - to <= AFTER_CHARS) {
    return lineText.slice(to);
  }
  return `${lineText.slice(to, to + AFTER_CHARS).replace(HIGH_SURROGATE, "")}${CUT_MARK}`;
}

export function previewOf({
  lineText,
  from,
  to,
}: Pick<LineHit, "lineText" | "from" | "to">): Preview {
  return {
    before: beforeOf(lineText, from),
    match: lineText.slice(from, to),
    after: afterOf(lineText, to),
  };
}
