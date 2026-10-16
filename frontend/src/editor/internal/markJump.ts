import { forEachDiagnostic } from "@codemirror/lint";
import type { EditorState, StateField } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

import type { ChunkSpan } from "./chunkField";
import type { ChunkRow, Pane, PaneViews } from "./geometry";
import type { MarkTarget } from "./marks";
import type { SideFocus } from "./sideFocus";
import { thirdScrollTop } from "./viewport";

type JumpParts = {
  readonly views: PaneViews;
  readonly spans: StateField<readonly ChunkSpan[]>;
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

// WebStorm's stripe click puts the caret at the line's end first to open a fold around it, then at
// the mark's start (intellij-community EditorMarkupModelImpl.kt doClick).
function jumpInResult({ views, spans }: JumpParts, target: MarkTarget): void {
  const view = views.center;
  const start = startOf(view.state, spans, target);
  if (start === null) {
    return;
  }
  view.dispatch({ selection: { anchor: view.state.doc.lineAt(start).to } });
  view.dispatch({ selection: { anchor: start } });
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
  parts.focus.focusChange(pane === "left" ? "local" : "remote", row.chunk.id);
  scrollToThird(parts.views[pane], row[pane].top);
}
