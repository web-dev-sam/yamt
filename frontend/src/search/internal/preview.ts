import type { LineHit } from "./match";

export type Preview = { readonly before: string; readonly match: string; readonly after: string };

const BEFORE_CHARS = 26;
const CUT_MARK = "…";
const LOW_SURROGATE = /^[\uDC00-\uDFFF]/;

export function previewOf({
  lineText,
  from,
  to,
}: Pick<LineHit, "lineText" | "from" | "to">): Preview {
  const before = lineText.slice(0, from).trimStart();
  const match = lineText.slice(from, to);
  const after = lineText.slice(to);
  if (before.length <= BEFORE_CHARS) {
    return { before, match, after };
  }
  const kept = before.slice(-BEFORE_CHARS).replace(LOW_SURROGATE, "");
  return { before: `${CUT_MARK}${kept}`, match, after };
}
