import type { EditorView } from "@codemirror/view";

import type { Span } from "../../connectors";
import type { VisibleLines } from "./apply";

const REVEAL_GAP_LINES = 2;
const REVEAL_PARTS = 3;

export function visibleLines(view: EditorView): VisibleLines {
  const top = view.scrollDOM.getBoundingClientRect().top - view.documentTop;
  const bottom = top + view.scrollDOM.clientHeight;
  const first = view.lineBlockAtHeight(top);
  const last = view.lineBlockAtHeight(bottom);
  const doc = view.state.doc;
  const firstLine = doc.lineAt(first.from).number;
  const lastLine = doc.lineAt(last.from).number;
  return {
    first: first.top < top && firstLine < lastLine ? firstLine + 1 : firstLine,
    last: last.bottom > bottom && lastLine > firstLine ? lastLine - 1 : lastLine,
  };
}

export function visibleArea(view: EditorView): Span {
  const { scrollTop, clientHeight } = view.scrollDOM;
  const top = scrollTop - view.documentPadding.top;
  return { top, bottom: top + clientHeight };
}

// WebStorm's placement of a difference it scrolls to (intellij-community
// platform/diff-impl/src/com/intellij/diff/tools/util/SyncScrollSupport.java, getTargetOffsets).
export function revealScrollTop(
  span: Span,
  {
    area,
    lineHeight,
    paddingTop,
  }: { readonly area: Span; readonly lineHeight: number; readonly paddingTop: number },
): number | null {
  if (span.top >= area.top && span.bottom <= area.bottom) {
    return null;
  }
  const height = area.bottom - area.top;
  const changeHeight = span.bottom - span.top;
  const gap = REVEAL_GAP_LINES * lineHeight;
  const fits = changeHeight + gap + gap <= height;
  const offset = fits ? Math.min(height / REVEAL_PARTS, height - gap - changeHeight) : gap;
  return Math.max(0, span.top - offset + paddingTop);
}
