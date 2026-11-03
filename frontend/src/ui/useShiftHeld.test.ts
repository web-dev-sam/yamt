import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { effectScope, nextTick, type EffectScope } from "vue";

import { shiftHeldAfter, useShiftHeld } from "./useShiftHeld";

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
  expect(shiftHeldAfter(false, { kind: "keydown", key: "Shift" })).toBe(true);
  expect(shiftHeldAfter(true, { kind: "keydown", key: "Shift" })).toBe(true);
  expect(shiftHeldAfter(true, { kind: "keyup", key: "Shift" })).toBe(false);
  expect(shiftHeldAfter(false, { kind: "keyup", key: "Shift" })).toBe(false);
});

test("another key's press or release changes nothing", () => {
  expect(shiftHeldAfter(true, { kind: "keydown", key: "A" })).toBe(true);
  expect(shiftHeldAfter(false, { kind: "keydown", key: "a" })).toBe(false);
  expect(shiftHeldAfter(true, { kind: "keyup", key: "A" })).toBe(true);
  expect(shiftHeldAfter(false, { kind: "keyup", key: "a" })).toBe(false);
});

test("a pointer event without Shift hides, with Shift keeps, and never shows", () => {
  expect(shiftHeldAfter(true, { kind: "pointer", shiftKey: false })).toBe(false);
  expect(shiftHeldAfter(true, { kind: "pointer", shiftKey: true })).toBe(true);
  expect(shiftHeldAfter(false, { kind: "pointer", shiftKey: true })).toBe(false);
});

test("leaving the window hides", () => {
  expect(shiftHeldAfter(true, { kind: "left" })).toBe(false);
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
