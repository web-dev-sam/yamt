import { log, type ClipboardSelection } from "../ipc";
import { unexpected } from "./problem";

type ReadClipboard = (selection: ClipboardSelection) => Promise<string | null>;

const MIDDLE_BUTTON = 1;

export function takeLinuxPastes(target: Window, read: ReadClipboard): void {
  const afterMiddleRelease = middleReleases(target);
  // WebKitGTK 2.54 crashes reading a pasteboard whose formats GTK cannot list (bug 324466); a cancelled
  // `paste` event stops every paste before that read (Editor.cpp:1660-1666, 1676-1681).
  target.addEventListener(
    "paste",
    (event) => {
      if (!event.isTrusted) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      const pasted = event.target;
      if (!(pasted instanceof Node)) {
        return;
      }
      read(afterMiddleRelease() ? "primary" : "clipboard").then(
        (text) => {
          deliver(target.document, pasted, text);
        },
        (error: unknown) => {
          log.warn("paste.read_failed", { ...unexpected(error) });
        },
      );
    },
    { capture: true },
  );
}

// WebKit pastes the selection on a middle release right after dispatching its `mouseup`, in the same
// task (EventHandler.cpp:1325-1340, 2636-2638 at webkitgtk-2.54.1).
function middleReleases(target: Window): () => boolean {
  let released = false;
  target.addEventListener(
    "mouseup",
    (event) => {
      if (event.button !== MIDDLE_BUTTON) {
        return;
      }
      released = true;
      target.setTimeout(() => {
        released = false;
      });
    },
    { capture: true, passive: true },
  );
  return () => released;
}

function deliver(document: Document, pasted: Node, text: string | null): void {
  const focused = document.activeElement?.contains(pasted) ?? false;
  if (text === null || text === "" || !focused) {
    return;
  }
  const clipboardData = new DataTransfer();
  clipboardData.setData("text/plain", text);
  const paste = new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true });
  const handled = !pasted.dispatchEvent(paste);
  if (!handled && (pasted instanceof HTMLInputElement || pasted instanceof HTMLTextAreaElement)) {
    document.execCommand("insertText", false, text);
  }
}
