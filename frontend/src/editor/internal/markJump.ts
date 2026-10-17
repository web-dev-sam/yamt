import { forEachDiagnostic } from "@codemirror/lint";
import type { EditorState, StateField, TransactionSpec } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

import type { ChunkSpan } from "./chunkField";
import { paneFolds, type FoldFields } from "./folds";
import { PANE_TINT, type ChunkRow, type Pane, type PaneViews } from "./geometry";
import type { MarkTarget } from "./marks";
import type { SideFocus } from "./sideFocus";
import { thirdScrollTop } from "./viewport";

type JumpParts = {
  readonly views: PaneViews;
  readonly spans: StateField<readonly ChunkSpan[]>;
  readonly folds: FoldFields;
  readonly focus: SideFocus;
  readonly rows: readonly ChunkRow[];
};

function startOf(
  state: EditorState,
  spans: StateField<readonly ChunkSpan[]>,
  target: MarkTarget,
): number | null {
  switch (target.kind) {
    case "change":
      return state.field(spans).find(({ chunk }) => chunk.id === target.id)?.from ?? null;
    case "problem": {
      let start: number | null = null;
      forEachDiagnostic(state, (diagnostic, from) => {
        if (diagnostic === target.diagnostic) {
          start = from;
        }
      });
      return start;
    }
    default: {
      const _exhaustive: never = target;
      return _exhaustive;
    }
  }
}

function scrollToThird(view: EditorView, top: number): void {
  const { scrollDOM } = view;
  scrollDOM.scrollTop = thirdScrollTop(top, {
    clientHeight: scrollDOM.clientHeight,
    scrollHeight: scrollDOM.scrollHeight,
    paddingTop: view.documentPadding.top,
  });
}

export function revealSteps(
  state: EditorState,
  folds: FoldFields,
  start: number,
): readonly TransactionSpec[] {
  const cursor = { selection: { anchor: start } };
  const hidden = paneFolds(folds, "center", state)
    .flatMap(({ hidden: levels }) => levels.flatMap(({ center }) => center ?? []))
    .findLast(({ from, to }) => from <= start && start <= to);
  return hidden === undefined
    ? [cursor]
    : [{ selection: { anchor: hidden.from, head: hidden.to } }, cursor];
}

function jumpInResult({ views, spans, folds }: JumpParts, target: MarkTarget): void {
  const view = views.center;
  const start = startOf(view.state, spans, target);
  if (start === null) {
    return;
  }
  for (const step of revealSteps(view.state, folds, start)) {
    view.dispatch(step);
  }
  view.focus();
  scrollToThird(view, view.lineBlockAt(start).top);
}

export function jumpTo(parts: JumpParts, pane: Pane, target: MarkTarget): void {
  if (pane === "center") {
    jumpInResult(parts, target);
    return;
  }
  const row =
    target.kind === "change" ? parts.rows.find(({ chunk }) => chunk.id === target.id) : undefined;
  if (row === undefined) {
    return;
  }
  parts.focus.focusChange(PANE_TINT[pane], row.chunk.id);
  scrollToThird(parts.views[pane], row[pane].top);
}
