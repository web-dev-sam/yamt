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

function heldIn(): Readonly<{ value: boolean }> {
  const held = scope.run(() => useShiftHeld());
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
  send(page.window, "keyup", { key: "A" });
  expect(held.value).toBe(true);
});

test("keys are heard in the capture phase; pointers not while Shift is up", () => {
  heldIn();

  expect(Object.fromEntries(page.window.listening)).toEqual({
    keydown: "capture",
    keyup: "capture",
    blur: "",
  });
});

test("while held, pointer events are heard in the capture phase, passively", async () => {
  const held = heldIn();

  send(page.window, "keydown", { key: "Shift" });
  await nextTick();
  expect(Object.fromEntries(page.window.listening)).toEqual({
    keydown: "capture",
    keyup: "capture",
    blur: "",
    pointerdown: "capture passive",
    pointermove: "capture passive",
    pointerup: "capture passive",
  });

  send(page.window, "keyup", { key: "Shift" });
  await nextTick();
  expect(held.value).toBe(false);
  expect([...page.window.listening.keys()]).toEqual(["keydown", "keyup", "blur"]);
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

test("the window losing focus hides", () => {
  const held = heldIn();
  send(page.window, "keydown", { key: "Shift" });

  send(page.window, "blur");
  expect(held.value).toBe(false);
});

test("the page becoming hidden hides; becoming visible does not", async () => {
  const held = heldIn();
  send(page.window, "keydown", { key: "Shift" });

  page.document.visibilityState = "hidden";
  send(page.document, "visibilitychange");
  await nextTick();
  expect(held.value).toBe(false);

  send(page.window, "keydown", { key: "Shift" });
  page.document.visibilityState = "visible";
  send(page.document, "visibilitychange");
  await nextTick();
  expect(held.value).toBe(true);
});

test("no event's default is prevented", async () => {
  heldIn();
  const events = [send(page.window, "keydown", { key: "Shift" })];
  await nextTick();
  events.push(
    send(page.window, "pointermove", { shiftKey: true }),
    send(page.window, "keyup", { key: "Shift" }),
  );

  expect(events.map((event) => event.defaultPrevented)).toEqual([false, false, false]);
});
