import type { Extension, StateField, Text } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

import type { Chunk } from "../../ipc";
import type { Side } from "./side";
import { isSideOpen, type ChunkState } from "./status";

type Modifiers = Pick<MouseEvent, "ctrlKey" | "metaKey">;

export function isModHeld({ ctrlKey, metaKey }: Modifiers, platform: string): boolean {
  // The platform test CodeMirror uses for `Mod` (@codemirror/view browser.mac); on macOS
  // Ctrl+click is the system's secondary click.
  return /Mac/.test(platform) ? metaKey && !ctrlKey : ctrlKey && !metaKey;
}

export function openBlockAt(
  states: readonly ChunkState[],
  { side, doc, pos }: { readonly side: Side; readonly doc: Text; readonly pos: number },
): Chunk | null {
  const line = doc.lineAt(pos).number - 1;
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
  const platform = navigator.platform;
  return EditorView.domEventHandlers({
    mousedown(event, view) {
      const height = event.clientY - view.documentTop;
      if (
        event.button !== 0 ||
        !isModHeld(event, platform) ||
        height < 0 ||
        height >= view.lineBlockAt(view.state.doc.length).bottom
      ) {
        return false;
      }
      const pos = view.lineBlockAtHeight(height).from;
      const chunk = openBlockAt(view.state.field(statuses), { side, doc: view.state.doc, pos });
      if (chunk === null) {
        return false;
      }
      event.preventDefault();
      apply(chunk);
      return true;
    },
  });
}
