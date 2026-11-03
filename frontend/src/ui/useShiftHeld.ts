import { createSharedComposable } from "@vueuse/core";

import { useKeyHold } from "./keyHold";

export type ShiftEvent =
  | { readonly kind: "keydown"; readonly key: string }
  | { readonly kind: "keyup"; readonly key: string }
  | { readonly kind: "pointer"; readonly shiftKey: boolean }
  | { readonly kind: "left" };

const SHIFT = "Shift";
const POINTER_EVENTS = ["pointerdown", "pointermove", "pointerup"];

export function shiftHeldAfter(held: boolean, event: ShiftEvent): boolean {
  switch (event.kind) {
    case "keydown":
      return held || event.key === SHIFT;
    // X11 sends a key event's modifiers as they were just before it (Xlib XKeyEvent `state`), so WebKitGTK reports
    // Shift as still set on Shift's own release: only the key name tells.
    case "keyup":
      return held && event.key !== SHIFT;
    case "pointer":
      return held && event.shiftKey;
    case "left":
      return false;
  }
}

export const useShiftHeld = createSharedComposable(() =>
  useKeyHold(shiftHeldAfter, POINTER_EVENTS),
);
