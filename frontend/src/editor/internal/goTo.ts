import type { EditorState, StateField, Text, TransactionSpec } from "@codemirror/state";

import type { ChunkSpan } from "./chunkField";
import { selectMatch } from "./findMatch";
import type { Pane } from "./geometry";

export type PaneMatch = { readonly line: number; readonly from: number; readonly to: number };
export type MergeGoTo = { readonly pane: Pane; readonly match: PaneMatch | null };

type Lines = { readonly start: number; readonly len: number };

export type ResultLineUp = {
  readonly result: string;
  readonly changes: readonly Readonly<Record<Pane, Lines>>[];
};

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

export function changeLines(doc: Text, { from, to }: Pick<ChunkSpan, "from" | "to">): Lines {
  const first = doc.lineAt(from);
  const start = from === to && first.from !== from ? first.number : first.number - 1;
  const last = doc.lineAt(to);
  const end = last.from === to ? last.number - 1 : last.number;
  return { start, len: end - start };
}

export function resultLineUp(
  state: EditorState,
  field: StateField<readonly ChunkSpan[]>,
  result: string,
): ResultLineUp {
  return {
    result,
    changes: state.field(field).map((span) => ({
      left: span.chunk.local,
      center: changeLines(state.doc, span),
      right: span.chunk.remote,
    })),
  };
}
