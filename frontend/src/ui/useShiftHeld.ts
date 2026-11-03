import { useDocumentVisibility, useEventListener } from "@vueuse/core";
import { shallowRef, watch, type ShallowRef } from "vue";

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
    case "keyup":
      return held && event.key !== SHIFT;
    case "pointer":
      return held && event.shiftKey;
    case "left":
      return false;
  }
}

export function useShiftHeld(): Readonly<ShallowRef<boolean>> {
  const held = shallowRef(false);
  function apply(event: ShiftEvent): void {
    held.value = shiftHeldAfter(held.value, event);
  }

  useEventListener(
    window,
    "keydown",
    (event) => {
      apply({ kind: "keydown", key: event.key });
    },
    { capture: true },
  );
  // X11 sends a key event's modifiers as they were just before it (Xlib XKeyEvent `state`), so WebKitGTK reports
  // Shift as still set on Shift's own release: only the key name tells.
  useEventListener(
    window,
    "keyup",
    (event) => {
      apply({ kind: "keyup", key: event.key });
    },
    { capture: true },
  );
  useEventListener(window, "blur", () => {
    apply({ kind: "left" });
  });
  watch(useDocumentVisibility(), (visibility) => {
    if (visibility === "hidden") {
      apply({ kind: "left" });
    }
  });
  useEventListener<PointerEvent>(
    () => (held.value ? window : null),
    POINTER_EVENTS,
    (event) => {
      apply({ kind: "pointer", shiftKey: event.shiftKey });
    },
    { capture: true, passive: true },
  );
  return held;
}
