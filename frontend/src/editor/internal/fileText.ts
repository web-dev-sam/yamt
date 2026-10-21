import { ChangeSet, type EditorState, type StateField, type Text } from "@codemirror/state";

import { sideLines, wholeLines, type SideDocs } from "./apply";
import type { ChunkSpan } from "./chunkField";
import { otherSide, sideChanged, SIDES, type Side } from "./side";
import { isResolved, isSideOpen, type ChunkState } from "./status";

export function dropsShownText({ chunk, status }: ChunkState): boolean {
  const { waiting } = chunk;
  switch (waiting.kind) {
    case "AsShown":
      return false;
    case "SideLines":
      return !isResolved(chunk, status);
    case "Markers":
      return SIDES.every((side) => isSideOpen(chunk, status, side));
    default: {
      const _exhaustive: never = waiting;
      return _exhaustive;
    }
  }
}

function shownLines(doc: Text, { from, to }: ChunkSpan): string[] {
  if (from === to) {
    return [];
  }
  const lines = doc.slice(from, to).toJSON();
  return doc.lineAt(to).from === to ? lines.slice(0, -1) : lines;
}

function writtenLines(span: ChunkSpan, doc: Text, sides: SideDocs): string[] | null {
  const { chunk, status } = span;
  const { waiting } = chunk;
  if (waiting.kind !== "Markers") {
    const side: Side = sideChanged(chunk, "local") ? "local" : "remote";
    return dropsShownText(span) ? sideLines(sides[side], chunk[side]) : null;
  }
  if (isResolved(chunk, status)) {
    return null;
  }
  const shown = dropsShownText(span) ? [] : shownLines(doc, span);
  const local = isSideOpen(chunk, status, "local") ? sideLines(sides.local, chunk.local) : shown;
  const remote = isSideOpen(chunk, status, "remote")
    ? sideLines(sides.remote, chunk.remote)
    : shown;
  const sections: Readonly<Record<Side, string[]>> = { local, remote };
  return [
    waiting.open,
    ...sections[waiting.first],
    ...waiting.between,
    ...sections[otherSide(waiting.first)],
    waiting.close,
  ];
}

export function fileText(
  state: EditorState,
  field: StateField<readonly ChunkSpan[]>,
  sides: SideDocs,
): string {
  const { doc, lineBreak } = state;
  const changes = state.field(field).flatMap((span) => {
    const lines = writtenLines(span, doc, sides);
    return lines === null ? [] : [wholeLines(doc, span, lines)];
  });
  return ChangeSet.of(changes, doc.length, lineBreak)
    .apply(doc)
    .sliceString(0, undefined, lineBreak);
}
