import { useDocumentVisibility, useEventListener } from "@vueuse/core";
import { shallowRef, watch, type ShallowRef } from "vue";

export type HoldEvent =
  | { readonly kind: "keydown"; readonly key: string; readonly repeat: boolean }
  | { readonly kind: "keyup"; readonly key: string; readonly altKey: boolean }
  | { readonly kind: "pointer"; readonly altKey: boolean }
  | { readonly kind: "left" };

const ALT = "Alt";
const POINTER_EVENTS = ["pointerdown", "pointermove", "pointerup", "wheel"];

export function heldAfter(held: boolean, event: HoldEvent): boolean {
  switch (event.kind) {
    case "keydown":
      if (event.key !== ALT) {
        return false;
      }
      return event.repeat ? held : true;
    case "keyup":
      if (event.key === ALT || !event.altKey) {
        return false;
      }
      return held;
    case "pointer":
      return held && event.altKey;
    case "left":
      return false;
  }
}

export function useAltHold(): Readonly<ShallowRef<boolean>> {
  const held = shallowRef(false);
  function apply(event: HoldEvent): void {
    held.value = heldAfter(held.value, event);
  }

  useEventListener(
    window,
    "keydown",
    (event) => {
      apply({ kind: "keydown", key: event.key, repeat: event.repeat });
    },
    { capture: true },
  );
  useEventListener(
    window,
    "keyup",
    (event) => {
      apply({ kind: "keyup", key: event.key, altKey: event.altKey });
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
  useEventListener<MouseEvent>(
    () => (held.value ? window : null),
    POINTER_EVENTS,
    (event) => {
      apply({ kind: "pointer", altKey: event.altKey });
    },
    { capture: true, passive: true },
  );
  return held;
}
