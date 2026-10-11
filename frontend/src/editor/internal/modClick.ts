import type { Extension, StateField } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

import type { Chunk } from "../../ipc";
import type { Side } from "./side";
import { isSideOpen, type ChunkState } from "./status";

export function openBlockAt(
  states: readonly ChunkState[],
  { side, line }: { readonly side: Side; readonly line: number },
): Chunk | null {
  const hit = states.find(
    ({ chunk, status }) =>
      isSideOpen(chunk, status, side) &&
      line >= chunk[side].start &&
      line < chunk[side].start + chunk[side].len,
  );
  return hit?.chunk ?? null;
}

export function applyOnModClick(
  statuses: StateField<readonly ChunkState[]>,
  side: Side,
  apply: (chunk: Chunk) => void,
): Extension {
  return EditorView.domEventHandlers({
    mousedown(event, view) {
      const height = event.clientY - view.documentTop;
      if (
        event.button !== 0 ||
        !(event.ctrlKey || event.metaKey) ||
        height < 0 ||
        height >= view.lineBlockAt(view.state.doc.length).bottom
      ) {
        return false;
      }
      const block = view.lineBlockAtHeight(height);
      const line = view.state.doc.lineAt(block.from).number - 1;
      const chunk = openBlockAt(view.state.field(statuses), { side, line });
      if (chunk === null) {
        return false;
      }
      event.preventDefault();
      apply(chunk);
      return true;
    },
  });
}
