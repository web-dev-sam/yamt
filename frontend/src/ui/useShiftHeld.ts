import { createSharedComposable } from "@vueuse/core";
import { computed, type Ref } from "vue";

import { useKeyHold, type KeyHold } from "./keyHold";

export type ShiftEvent =
  | { readonly kind: "keydown"; readonly key: string }
  | { readonly kind: "keyup"; readonly key: string }
  | { readonly kind: "pointer"; readonly shiftKey: boolean; readonly pressed: boolean }
  | { readonly kind: "left" };

export type ShiftState =
  | { readonly kind: "up"; readonly taps: number }
  | { readonly kind: "held"; readonly alone: boolean; readonly taps: number };

const SHIFT = "Shift";
const POINTER_EVENTS = ["pointerdown", "pointermove", "pointerup"];

function released(state: ShiftState, tapped: boolean): ShiftState {
  return { kind: "up", taps: tapped ? state.taps + 1 : state.taps };
}

function whileHeld(state: Extract<ShiftState, { kind: "held" }>, event: ShiftEvent): ShiftState {
  switch (event.kind) {
    case "keydown":
      return event.key === SHIFT ? state : { ...state, alone: false };
    // X11 sends a key event's modifiers as they were just before it (Xlib XKeyEvent `state`), so WebKitGTK reports
    // Shift as still set on Shift's own release: only the key name tells.
    case "keyup":
      return event.key === SHIFT ? released(state, state.alone) : state;
    case "pointer":
      if (!event.shiftKey) {
        return released(state, false);
      }
      return event.pressed ? { ...state, alone: false } : state;
    case "left":
      return released(state, false);
  }
}

export function shiftAfter(state: ShiftState, event: ShiftEvent): ShiftState {
  if (state.kind === "held") {
    return whileHeld(state, event);
  }
  return event.kind === "keydown" && event.key === SHIFT
    ? { kind: "held", alone: true, taps: state.taps }
    : state;
}

const SHIFT_HOLD: KeyHold<ShiftState> = {
  start: { kind: "up", taps: 0 },
  after: shiftAfter,
  holding: (state) => state.kind === "held",
};

const useShiftState = createSharedComposable(() => useKeyHold(SHIFT_HOLD, POINTER_EVENTS));

export const useShiftHeld = createSharedComposable((): Readonly<Ref<boolean>> => {
  const state = useShiftState();
  return computed(() => state.value.kind === "held");
});

/** Counts Shift taps: Shift down then up with no other key and no pointer press between. */
export const useShiftTaps = createSharedComposable((): Readonly<Ref<number>> => {
  const state = useShiftState();
  return computed(() => state.value.taps);
});
