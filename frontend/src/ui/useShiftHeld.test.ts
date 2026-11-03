import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { effectScope, nextTick, type EffectScope } from "vue";

import {
  shiftAfter,
  useShiftHeld,
  useShiftTaps,
  type ShiftEvent,
  type ShiftState,
} from "./useShiftHeld";

const UP: ShiftState = { kind: "up", taps: 2 };
const ALONE: ShiftState = { kind: "held", alone: true, taps: 2 };
const CHORD: ShiftState = { kind: "held", alone: false, taps: 2 };
const SHIFT_DOWN: ShiftEvent = { kind: "keydown", key: "Shift" };
const SHIFT_UP: ShiftEvent = { kind: "keyup", key: "Shift" };

function after(state: ShiftState, ...events: ShiftEvent[]): ShiftState {
  return events.reduce(shiftAfter, state);
}

const page = vi.hoisted(() => {
  class Target extends EventTarget {
    readonly listening = new Map<string, string>();
    override addEventListener(
      type: string,
      callback: EventListenerOrEventListenerObject | null,
      options?: AddEventListenerOptions | boolean,
    ): void {
      const flags = typeof options === "object" ? options : { capture: options === true };
      const words = [
        flags.capture === true ? "capture" : "",
        flags.passive === true ? "passive" : "",
      ];
      this.listening.set(type, words.filter((word) => word !== "").join(" "));
      super.addEventListener(type, callback, options);
    }
    override removeEventListener(
      type: string,
      callback: EventListenerOrEventListenerObject | null,
      options?: EventListenerOptions | boolean,
    ): void {
      this.listening.delete(type);
      super.removeEventListener(type, callback, options);
    }
  }
  const document = Object.assign(new Target(), {
    visibilityState: "visible",
    createElement: () => ({}),
  });
  const window = Object.assign(new Target(), { document });
  vi.stubGlobal("window", window);
  vi.stubGlobal("document", document);
  return { window, document };
});

let scope: EffectScope;

beforeEach(() => {
  page.document.visibilityState = "visible";
  scope = effectScope();
});

afterEach(() => {
  scope.stop();
});

function heldIn(within: EffectScope = scope): Readonly<{ value: boolean }> {
  const held = within.run(() => useShiftHeld());
  if (held === undefined) {
    throw new Error("scope stopped");
  }
  return held;
}

function send(target: EventTarget, type: string, fields: Record<string, unknown> = {}): Event {
  const event = Object.assign(new Event(type, { cancelable: true }), fields);
  target.dispatchEvent(event);
  return event;
}

test("Shift's press shows and its release hides", () => {
  expect(shiftAfter(UP, SHIFT_DOWN)).toEqual(ALONE);
  expect(shiftAfter(ALONE, SHIFT_DOWN)).toBe(ALONE);
  expect(shiftAfter(CHORD, SHIFT_UP)).toEqual(UP);
  expect(shiftAfter(UP, SHIFT_UP)).toBe(UP);
});

test("another key's press or release changes nothing while up, and a release nothing while held", () => {
  expect(shiftAfter(UP, { kind: "keydown", key: "a" })).toBe(UP);
  expect(shiftAfter(UP, { kind: "keyup", key: "a" })).toBe(UP);
  expect(shiftAfter(CHORD, { kind: "keyup", key: "A" })).toBe(CHORD);
  expect(shiftAfter(ALONE, { kind: "keyup", key: "A" })).toBe(ALONE);
});

test("a pointer event without Shift hides, with Shift keeps, and never shows", () => {
  expect(shiftAfter(ALONE, { kind: "pointer", shiftKey: false, pressed: false })).toEqual(UP);
  expect(shiftAfter(ALONE, { kind: "pointer", shiftKey: true, pressed: false })).toBe(ALONE);
  expect(shiftAfter(UP, { kind: "pointer", shiftKey: true, pressed: true })).toBe(UP);
});

test("leaving the window hides", () => {
  expect(shiftAfter(ALONE, { kind: "left" })).toEqual(UP);
  expect(shiftAfter(UP, { kind: "left" })).toBe(UP);
});

test("a_lone_shift_press_and_release_is_a_tap", () => {
  expect(after(UP, SHIFT_DOWN, SHIFT_UP)).toEqual({ kind: "up", taps: 3 });
  expect(after(UP, SHIFT_DOWN, SHIFT_UP, SHIFT_DOWN, SHIFT_UP)).toEqual({ kind: "up", taps: 4 });
});

test("shift_with_another_key_is_no_tap", () => {
  const shiftE = after(UP, SHIFT_DOWN, { kind: "keydown", key: "E" });
  expect(shiftE).toEqual(CHORD);
  expect(after(shiftE, { kind: "keyup", key: "E" }, SHIFT_UP)).toEqual(UP);
});

test("shift_with_a_pointer_press_is_no_tap", () => {
  const click = after(UP, SHIFT_DOWN, { kind: "pointer", shiftKey: true, pressed: true });
  expect(click).toEqual(CHORD);
  expect(after(click, { kind: "pointer", shiftKey: true, pressed: false }, SHIFT_UP)).toEqual(UP);
});

test("a_held_repeat_keeps_the_tap", () => {
  expect(after(UP, SHIFT_DOWN, SHIFT_DOWN, SHIFT_DOWN, SHIFT_UP)).toEqual({ kind: "up", taps: 3 });
  expect(shiftAfter(CHORD, SHIFT_DOWN)).toBe(CHORD);
});

test("a_pointer_move_while_shift_is_held_keeps_the_tap", () => {
  expect(
    after(UP, SHIFT_DOWN, { kind: "pointer", shiftKey: true, pressed: false }, SHIFT_UP),
  ).toEqual({ kind: "up", taps: 3 });
});

test("leaving_the_window_ends_the_hold_without_a_tap", () => {
  expect(after(UP, SHIFT_DOWN, { kind: "left" }, SHIFT_UP)).toEqual(UP);
});

test("a_pointer_without_shift_ends_the_hold_without_a_tap", () => {
  expect(
    after(UP, SHIFT_DOWN, { kind: "pointer", shiftKey: false, pressed: false }, SHIFT_UP),
  ).toEqual(UP);
});

test("down shows, up hides at once", () => {
  const held = heldIn();

  send(page.window, "keydown", { key: "Shift", shiftKey: true });
  expect(held.value).toBe(true);
  send(page.window, "keyup", { key: "Shift", shiftKey: false });
  expect(held.value).toBe(false);
});

test("a release that still reports Shift as set hides", () => {
  const held = heldIn();
  send(page.window, "keydown", { key: "Shift", shiftKey: false });
  expect(held.value).toBe(true);

  const release = Object.assign(new Event("keyup"), {
    key: "Shift",
    shiftKey: true,
    getModifierState: (modifier: string) => modifier === "Shift",
  });
  page.window.dispatchEvent(release);
  expect(held.value).toBe(false);
});

test("typing while Shift is held keeps the icons", () => {
  const held = heldIn();
  send(page.window, "keydown", { key: "Shift" });

  send(page.window, "keydown", { key: "A" });
  send(page.window, "keyup", { key: "A", shiftKey: true });
  expect(held.value).toBe(true);
});

test("while held, pointer events and no wheel are heard", async () => {
  heldIn();

  send(page.window, "keydown", { key: "Shift" });
  await nextTick();
  expect([...page.window.listening.keys()]).toEqual([
    "keydown",
    "keyup",
    "blur",
    "pointerdown",
    "pointermove",
    "pointerup",
  ]);
});

test.each(["pointerdown", "pointermove", "pointerup"])(
  "a %s with Shift keeps them, without Shift hides them",
  async (type) => {
    const held = heldIn();
    send(page.window, "keydown", { key: "Shift" });
    await nextTick();

    send(page.window, type, { shiftKey: true });
    expect(held.value).toBe(true);
    send(page.window, type, { shiftKey: false });
    expect(held.value).toBe(false);
  },
);

test("every filter shares one state and one set of listeners until the last one goes", () => {
  const other = effectScope();
  const held = heldIn();
  const otherHeld = heldIn(other);
  expect(otherHeld).toBe(held);

  scope.stop();
  send(page.window, "keydown", { key: "Shift" });
  expect(otherHeld.value).toBe(true);

  other.stop();
  expect([...page.window.listening.keys()]).toEqual([]);
});

test("held_and_taps_share_one_listener_set", () => {
  const other = effectScope();
  const held = heldIn();
  const taps = other.run(() => useShiftTaps());
  expect([...page.window.listening.keys()]).toEqual(["keydown", "keyup", "blur"]);

  send(page.window, "keydown", { key: "Shift" });
  expect(held.value).toBe(true);
  send(page.window, "keyup", { key: "Shift" });
  expect(held.value).toBe(false);
  expect(taps?.value).toBe(1);

  scope.stop();
  send(page.window, "keydown", { key: "Shift" });
  send(page.window, "keyup", { key: "Shift" });
  expect(taps?.value).toBe(2);

  other.stop();
  expect([...page.window.listening.keys()]).toEqual([]);
});
