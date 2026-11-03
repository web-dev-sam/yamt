import type { ShallowRef } from "vue";

import { useKeyHold } from "./keyHold";

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
  return useKeyHold(heldAfter, POINTER_EVENTS);
}
