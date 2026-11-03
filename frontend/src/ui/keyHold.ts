import { useDocumentVisibility, useEventListener } from "@vueuse/core";
import { shallowRef, watch, type ShallowRef } from "vue";

export type KeyHoldEvent =
  | { readonly kind: "keydown"; readonly key: string; readonly repeat: boolean }
  | {
      readonly kind: "keyup";
      readonly key: string;
      readonly altKey: boolean;
      readonly shiftKey: boolean;
    }
  | { readonly kind: "pointer"; readonly altKey: boolean; readonly shiftKey: boolean }
  | { readonly kind: "left" };

type HoldRule = (held: boolean, event: KeyHoldEvent) => boolean;

export function useKeyHold(rule: HoldRule, pointerEvents: string[]): Readonly<ShallowRef<boolean>> {
  const held = shallowRef(false);
  function apply(event: KeyHoldEvent): void {
    held.value = rule(held.value, event);
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
      apply({ kind: "keyup", key: event.key, altKey: event.altKey, shiftKey: event.shiftKey });
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
    pointerEvents,
    (event) => {
      apply({ kind: "pointer", altKey: event.altKey, shiftKey: event.shiftKey });
    },
    { capture: true, passive: true },
  );
  return held;
}
