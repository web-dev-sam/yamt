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
  | {
      readonly kind: "pointer";
      readonly altKey: boolean;
      readonly shiftKey: boolean;
      readonly pressed: boolean;
    }
  | { readonly kind: "left" };

export type KeyHold<S> = {
  readonly start: S;
  after(state: S, event: KeyHoldEvent): S;
  /** Whether pointer events are listened to (only while a key is held). */
  holding(state: S): boolean;
};

function useLeaving(apply: (event: KeyHoldEvent) => void): void {
  useEventListener(window, "blur", () => {
    apply({ kind: "left" });
  });
  watch(useDocumentVisibility(), (visibility) => {
    if (visibility === "hidden") {
      apply({ kind: "left" });
    }
  });
}

export function useKeyHold<S>(
  hold: KeyHold<S>,
  pointerEvents: readonly string[],
): Readonly<ShallowRef<S>> {
  const state = shallowRef(hold.start);
  function apply(event: KeyHoldEvent): void {
    state.value = hold.after(state.value, event);
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
  useLeaving(apply);
  useEventListener<MouseEvent>(
    () => (hold.holding(state.value) ? window : null),
    [...pointerEvents],
    (event) => {
      apply({
        kind: "pointer",
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        pressed: event.type === "pointerdown",
      });
    },
    { capture: true, passive: true },
  );
  return state;
}
