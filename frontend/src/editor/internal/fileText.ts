import {
  ChangeSet,
  Text,
  type ChangeSpec,
  type EditorState,
  type StateField,
} from "@codemirror/state";

import { sideLines, type SideDocs } from "./apply";
import type { ChunkSpan } from "./chunkField";
import { sideChanged, type Side } from "./side";
import { isResolved } from "./status";

function spanLines(doc: Text, { from, to }: ChunkSpan): string[] {
  if (from === to) {
    return [];
  }
  const first = doc.lineAt(from).number;
  const end = doc.lineAt(to);
  const last = end.from === to ? end.number - 1 : end.number;
  return Array.from({ length: last - first + 1 }, (_, index) => doc.line(first + index).text);
}

function writtenLines(span: ChunkSpan, doc: Text, sides: SideDocs): string[] | null {
  const { chunk, status } = span;
  const { waiting } = chunk;
  if (isResolved(chunk, status)) {
    return null;
  }
  switch (waiting.kind) {
    case "AsShown":
      return null;
    case "SideLines": {
      const side: Side = sideChanged(chunk, "local") ? "local" : "remote";
      return sideLines(sides[side], chunk[side]);
    }
    case "Markers": {
      const shown = spanLines(doc, span);
      const local = status.local === "pending" ? sideLines(sides.local, chunk.local) : shown;
      const remote = status.remote === "pending" ? sideLines(sides.remote, chunk.remote) : shown;
      return [waiting.open, ...local, ...waiting.between, ...remote, waiting.close];
    }
    default: {
      const _exhaustive: never = waiting;
      return _exhaustive;
    }
  }
}

function lineChange(doc: Text, { from, to }: ChunkSpan, lines: readonly string[]): ChangeSpec {
  const atFileEnd = to === doc.length && doc.lineAt(to).from !== to;
  const fromMidLine = doc.lineAt(from).from !== from;
  if (atFileEnd && lines.length === 0) {
    return { from: fromMidLine ? from : Math.max(0, from - 1), to };
  }
  const before = fromMidLine ? [""] : [];
  const after = atFileEnd ? [] : [""];
  return { from, to, insert: Text.of([...before, ...lines, ...after]) };
}

export function fileText(
  state: EditorState,
  field: StateField<readonly ChunkSpan[]>,
  sides: SideDocs,
): string {
  const { doc, lineBreak } = state;
  const changes = state.field(field).flatMap((span) => {
    const lines = writtenLines(span, doc, sides);
    return lines === null ? [] : [lineChange(doc, span, lines)];
  });
  return ChangeSet.of(changes, doc.length, lineBreak)
    .apply(doc)
    .sliceString(0, undefined, lineBreak);
}
