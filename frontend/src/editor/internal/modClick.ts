import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

import type { ChunkAction } from "./apply";
import type { ChunkRow } from "./geometry";
import { changeAt } from "./navigation";
import type { Side } from "./side";

type Modifiers = Pick<MouseEvent, "ctrlKey" | "metaKey">;
type Click = Modifiers & Pick<MouseEvent, "button">;

const MAIN_BUTTON = 0;
const SECONDARY_BUTTON = 2;
const BUTTON_ACTION: Readonly<Record<number, ChunkAction["kind"]>> = {
  [MAIN_BUTTON]: "apply",
  [SECONDARY_BUTTON]: "ignore",
};

// The platform test CodeMirror uses for `Mod` (@codemirror/view browser.mac).
function isMac(platform: string): boolean {
  return /Mac/.test(platform);
}

export function isModHeld({ ctrlKey, metaKey }: Modifiers, platform: string): boolean {
  // On macOS Ctrl+click is the system's secondary click.
  return isMac(platform) ? metaKey && !ctrlKey : ctrlKey && !metaKey;
}

export function modKeyName(platform: string): string {
  return isMac(platform) ? "⌘" : "Ctrl";
}

export function modClickAction(
  rows: readonly ChunkRow[],
  { side, y, click, platform }: { side: Side; y: number; click: Click; platform: string },
): ChunkAction | null {
  const kind = BUTTON_ACTION[click.button];
  if (kind === undefined || !isModHeld(click, platform)) {
    return null;
  }
  const id = changeAt(rows, side, y);
  const row = rows.find(({ chunk }) => chunk.id === id);
  return row === undefined ? null : { kind, side, chunks: [row.chunk] };
}

export function modClicks(
  side: Side,
  { rows, act }: { rows: () => readonly ChunkRow[]; act: (action: ChunkAction) => void },
): Extension {
  const platform = navigator.platform;
  function actionAt(click: MouseEvent, view: EditorView): ChunkAction | null {
    return modClickAction(rows(), { side, y: click.clientY - view.documentTop, click, platform });
  }
  return EditorView.domEventHandlers({
    mousedown(event, view) {
      const action = actionAt(event, view);
      if (action === null) {
        return false;
      }
      event.preventDefault();
      if (action.kind === "apply") {
        act(action);
      }
      return true;
    },
    contextmenu(event, view) {
      const action = actionAt(event, view);
      if (action?.kind !== "ignore") {
        return false;
      }
      event.preventDefault();
      act(action);
      return true;
    },
  });
}
