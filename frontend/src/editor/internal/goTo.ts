import type { EditorState, Text, TransactionSpec } from "@codemirror/state";

import { selectMatch } from "./findMatch";
import type { Pane } from "./geometry";

export type PaneMatch = { readonly line: number; readonly from: number; readonly to: number };
export type MergeGoTo = { readonly pane: Pane; readonly match: PaneMatch | null };

type GoToView = {
  readonly state: EditorState;
  dispatch(spec: TransactionSpec): void;
  focus(): void;
};

function clamped(value: number, max: number): number {
  return Math.min(Math.max(value, 0), max);
}

export function matchRange(doc: Text, match: PaneMatch): { from: number; to: number } {
  const line = doc.line(clamped(match.line, doc.lines - 1) + 1);
  const from = line.from + clamped(match.from, line.length);
  return { from, to: Math.max(from, line.from + clamped(match.to, line.length)) };
}

export function goTo(view: GoToView, match: PaneMatch | null): void {
  if (match !== null) {
    view.dispatch(selectMatch(matchRange(view.state.doc, match)));
  }
  view.focus();
}
