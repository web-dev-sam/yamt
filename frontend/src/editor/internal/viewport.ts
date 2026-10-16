import type { Text } from "@codemirror/state";
import type { BlockInfo, EditorView } from "@codemirror/view";

import type { Span } from "../../connectors";
import type { VisibleLines } from "./apply";

const REVEAL_GAP_LINES = 2;
const REVEAL_PARTS = 3;

type Block = Pick<BlockInfo, "from" | "to" | "top" | "bottom">;

export function textLineEdges(
  doc: Text,
  { first, last, area }: { readonly first: Block; readonly last: Block; readonly area: Span },
): VisibleLines {
  const firstIsWave = doc.lineAt(first.from).number !== doc.lineAt(first.to).number;
  const lastIsWave = doc.lineAt(last.from).number !== doc.lineAt(last.to).number;
  const firstLine = firstIsWave
    ? Math.min(doc.lineAt(first.to).number + 1, doc.lines)
    : doc.lineAt(first.from).number;
  const lastLine = lastIsWave
    ? Math.max(doc.lineAt(last.from).number - 1, 1)
    : doc.lineAt(last.from).number;
  return {
    first: !firstIsWave && first.top < area.top && firstLine < lastLine ? firstLine + 1 : firstLine,
    last:
      !lastIsWave && last.bottom > area.bottom && lastLine > firstLine ? lastLine - 1 : lastLine,
  };
}

export function visibleLines(view: EditorView): VisibleLines {
  const top = view.scrollDOM.getBoundingClientRect().top - view.documentTop;
  const bottom = top + view.scrollDOM.clientHeight;
  return textLineEdges(view.state.doc, {
    first: view.lineBlockAtHeight(top),
    last: view.lineBlockAtHeight(bottom),
    area: { top, bottom },
  });
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

// WebStorm's error-stripe jump: the line a third of the way down, also when it is on screen
// (intellij-community ScrollPositionCalculatorImpl.getVerticalOffset, CENTER).
export function thirdScrollTop(
  top: number,
  pane: {
    readonly clientHeight: number;
    readonly scrollHeight: number;
    readonly paddingTop: number;
  },
): number {
  const wanted = top + pane.paddingTop - pane.clientHeight / REVEAL_PARTS;
  return Math.min(Math.max(0, wanted), Math.max(0, pane.scrollHeight - pane.clientHeight));
}
