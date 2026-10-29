import type { EditorState, StateField, Text } from "@codemirror/state";

import type { ChunkSpan } from "./chunkField";
import type { Pane } from "./geometry";

type Lines = { readonly start: number; readonly len: number };

export type ResultLineUp = {
  readonly result: string;
  readonly changes: readonly Readonly<Record<Pane, Lines>>[];
};

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
  const changes: Readonly<Record<Pane, Lines>>[] = [];
  let end = 0;
  for (const span of state.field(field)) {
    const lines = changeLines(state.doc, span);
    const start = Math.max(lines.start, end);
    end = Math.max(start, lines.start + lines.len);
    changes.push({
      left: span.chunk.local,
      center: { start, len: end - start },
      right: span.chunk.remote,
    });
  }
  return { result, changes };
}
