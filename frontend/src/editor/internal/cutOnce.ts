import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

export function cutGate(reopen: (open: () => void) => void): () => boolean {
  let open = true;
  return () => {
    if (!open) {
      return false;
    }
    open = false;
    reopen(() => {
      open = true;
    });
    return true;
  };
}

// WebKitGTK 2.54 runs its Cut command twice for one Ctrl+X on an empty selection: two beforecut/cut
// pairs in the keydown's task, before a 0 ms timer queued at the first (docs/slices/briefs/3.U-cut.md).
export function cutOnce(): Extension {
  const takes = cutGate((open) => setTimeout(open, 0));
  return EditorView.domEventHandlers({ cut: () => !takes() });
}
