import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { effectScope, nextTick, type EffectScope } from "vue";

import { heldAfter, useAltHold, type HoldEvent } from "./altHold";

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

const ALT_DOWN: HoldEvent = { kind: "keydown", key: "Alt", repeat: false };
const ALT_REPEAT: HoldEvent = { kind: "keydown", key: "Alt", repeat: true };

let scope: EffectScope;

beforeEach(() => {
  page.document.visibilityState = "visible";
  scope = effectScope();
});

afterEach(() => {
  scope.stop();
});

function holdIn(): Readonly<{ value: boolean }> {
  const held = scope.run(() => useAltHold());
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

test("Alt's press shows, from shown or hidden", () => {
  expect(heldAfter(false, ALT_DOWN)).toBe(true);
  expect(heldAfter(true, ALT_DOWN)).toBe(true);
});

test.each([true, false])("AltGraph's press never shows (shown before: %s)", (held) => {
  expect(heldAfter(held, { kind: "keydown", key: "AltGraph", repeat: false })).toBe(false);
  expect(heldAfter(held, { kind: "keydown", key: "AltGraph", repeat: true })).toBe(false);
});

test("Alt's release hides, whatever altKey says", () => {
  expect(heldAfter(true, { kind: "keyup", key: "Alt", altKey: false })).toBe(false);
  expect(heldAfter(true, { kind: "keyup", key: "Alt", altKey: true })).toBe(false);
});

test("another key hides, and Alt's repeat keeps them hidden", () => {
  const afterKey = heldAfter(true, { kind: "keydown", key: "a", repeat: false });
  expect(afterKey).toBe(false);
  expect(heldAfter(afterKey, ALT_REPEAT)).toBe(false);
  expect(heldAfter(true, { kind: "keydown", key: "a", repeat: true })).toBe(false);
});

test("Alt's repeat while shown keeps them shown", () => {
  expect(heldAfter(true, ALT_REPEAT)).toBe(true);
});

test("another key's release with Alt up hides, with Alt down keeps", () => {
  expect(heldAfter(true, { kind: "keyup", key: "a", altKey: false })).toBe(false);
  expect(heldAfter(true, { kind: "keyup", key: "a", altKey: true })).toBe(true);
  expect(heldAfter(false, { kind: "keyup", key: "a", altKey: true })).toBe(false);
});

test("a pointer event with Alt up hides, with Alt down keeps, and never shows", () => {
  expect(heldAfter(true, { kind: "pointer", altKey: false })).toBe(false);
  expect(heldAfter(true, { kind: "pointer", altKey: true })).toBe(true);
  expect(heldAfter(false, { kind: "pointer", altKey: true })).toBe(false);
});

test("leaving the window hides", () => {
  expect(heldAfter(true, { kind: "left" })).toBe(false);
});

test("back with Alt still held shows nothing until a fresh press", () => {
  const back = [ALT_REPEAT, ALT_REPEAT].reduce(heldAfter, heldAfter(true, { kind: "left" }));
  expect(back).toBe(false);
  expect(heldAfter(back, ALT_DOWN)).toBe(true);
});

test("keys are heard in the capture phase; pointers not while Alt is up", () => {
  holdIn();

  expect(Object.fromEntries(page.window.listening)).toEqual({
    keydown: "capture",
    keyup: "capture",
    blur: "",
  });
});

test("while held, pointer and wheel events are heard in the capture phase, passively", async () => {
  const held = holdIn();

  send(page.window, "keydown", { key: "Alt", repeat: false });
  await nextTick();
  expect(held.value).toBe(true);
  expect(Object.fromEntries(page.window.listening)).toMatchObject({
    pointerdown: "capture passive",
    pointermove: "capture passive",
    pointerup: "capture passive",
    wheel: "capture passive",
  });

  send(page.window, "keyup", { key: "Alt", altKey: false });
  await nextTick();
  expect(held.value).toBe(false);
  expect([...page.window.listening.keys()]).toEqual(["keydown", "keyup", "blur"]);
});

test.each(["pointerdown", "pointermove", "pointerup", "wheel"])(
  "a %s with Alt down keeps them, with Alt up hides them",
  async (type) => {
    const held = holdIn();
    send(page.window, "keydown", { key: "Alt", repeat: false });
    await nextTick();

    send(page.window, type, { altKey: true });
    expect(held.value).toBe(true);
    send(page.window, type, { altKey: false });
    expect(held.value).toBe(false);
  },
);

test("another key's press and release reach the hold with their own fields", () => {
  const held = holdIn();
  send(page.window, "keydown", { key: "Alt", repeat: false });
  send(page.window, "keyup", { key: "a", altKey: true });
  expect(held.value).toBe(true);

  send(page.window, "keydown", { key: "a", repeat: false });
  expect(held.value).toBe(false);
  send(page.window, "keydown", { key: "Alt", repeat: true });
  expect(held.value).toBe(false);
});

test("the window losing focus hides", () => {
  const held = holdIn();
  send(page.window, "keydown", { key: "Alt", repeat: false });

  send(page.window, "blur");
  expect(held.value).toBe(false);
});

test("the page becoming hidden hides; becoming visible does not", async () => {
  const held = holdIn();
  send(page.window, "keydown", { key: "Alt", repeat: false });

  page.document.visibilityState = "hidden";
  send(page.document, "visibilitychange");
  await nextTick();
  expect(held.value).toBe(false);

  send(page.window, "keydown", { key: "Alt", repeat: false });
  page.document.visibilityState = "visible";
  send(page.document, "visibilitychange");
  await nextTick();
  expect(held.value).toBe(true);
});

test("no event's default is prevented", async () => {
  holdIn();
  const events = [
    send(page.window, "keydown", { key: "Alt", repeat: false }),
    send(page.window, "keyup", { key: "a", altKey: true }),
  ];
  await nextTick();
  events.push(
    send(page.window, "wheel", { altKey: true }),
    send(page.window, "keyup", { key: "Alt" }),
  );

  expect(events.map((event) => event.defaultPrevented)).toEqual([false, false, false, false]);
});
