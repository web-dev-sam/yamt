import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { effectScope, nextTick, type EffectScope } from "vue";

import { useKeyHold, type KeyHoldEvent } from "./keyHold";

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
let seen: KeyHoldEvent[];
let answer: boolean;

beforeEach(() => {
  page.document.visibilityState = "visible";
  scope = effectScope();
  seen = [];
  answer = true;
});

afterEach(() => {
  scope.stop();
});

function recording(_held: boolean, event: KeyHoldEvent): boolean {
  seen.push(event);
  return answer;
}

function holdIn(pointerEvents: string[] = ["pointermove", "wheel"]): Readonly<{ value: boolean }> {
  const held = scope.run(() => useKeyHold(recording, pointerEvents));
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

test("the rule's answer is the state, fed the state before", () => {
  const passed: boolean[] = [];
  const held = scope.run(() =>
    useKeyHold((before) => {
      passed.push(before);
      return !before;
    }, []),
  );

  send(page.window, "keydown", { key: "a", repeat: false });
  expect(held?.value).toBe(true);
  send(page.window, "keydown", { key: "a", repeat: false });
  expect(held?.value).toBe(false);
  expect(passed).toEqual([false, true]);
});

test("key presses and releases reach the rule with their key, repeat and modifiers", () => {
  holdIn();

  send(page.window, "keydown", { key: "Alt", repeat: true, altKey: true, shiftKey: true });
  send(page.window, "keyup", { key: "Shift", repeat: true, altKey: true, shiftKey: false });
  send(page.window, "keyup", { key: "a", altKey: false, shiftKey: true });
  expect(seen).toEqual([
    { kind: "keydown", key: "Alt", repeat: true },
    { kind: "keyup", key: "Shift", altKey: true, shiftKey: false },
    { kind: "keyup", key: "a", altKey: false, shiftKey: true },
  ]);
});

test("keys are heard in the capture phase; pointers not while not held", () => {
  answer = false;
  holdIn();
  send(page.window, "keydown", { key: "a", repeat: false });

  expect(Object.fromEntries(page.window.listening)).toEqual({
    keydown: "capture",
    keyup: "capture",
    blur: "",
  });
});

test("while held, the rule's pointer events are heard in the capture phase, passively", async () => {
  const held = holdIn(["pointerdown", "wheel"]);

  send(page.window, "keydown", { key: "a", repeat: false });
  await nextTick();
  expect(Object.fromEntries(page.window.listening)).toEqual({
    keydown: "capture",
    keyup: "capture",
    blur: "",
    pointerdown: "capture passive",
    wheel: "capture passive",
  });

  answer = false;
  send(page.window, "keyup", { key: "a" });
  await nextTick();
  expect(held.value).toBe(false);
  expect([...page.window.listening.keys()]).toEqual(["keydown", "keyup", "blur"]);
});

test("a pointer event reaches the rule with its modifiers", async () => {
  holdIn(["pointerdown", "wheel"]);
  send(page.window, "keydown", { key: "a", repeat: false });
  await nextTick();

  send(page.window, "pointerdown", { altKey: true, shiftKey: false });
  send(page.window, "wheel", { altKey: false, shiftKey: true });
  expect(seen.slice(1)).toEqual([
    { kind: "pointer", altKey: true, shiftKey: false },
    { kind: "pointer", altKey: false, shiftKey: true },
  ]);
});

test("the window losing focus reaches the rule as leaving", () => {
  holdIn();

  send(page.window, "blur");
  expect(seen).toEqual([{ kind: "left" }]);
});

test("the page becoming hidden reaches the rule as leaving; becoming visible does not", async () => {
  holdIn();

  page.document.visibilityState = "hidden";
  send(page.document, "visibilitychange");
  await nextTick();
  expect(seen).toEqual([{ kind: "left" }]);

  page.document.visibilityState = "visible";
  send(page.document, "visibilitychange");
  await nextTick();
  expect(seen).toEqual([{ kind: "left" }]);
});

test("no event's default is prevented", async () => {
  holdIn();
  const events = [send(page.window, "keydown", { key: "a", repeat: false })];
  await nextTick();
  events.push(
    send(page.window, "wheel", { altKey: true }),
    send(page.window, "pointermove", { altKey: true }),
    send(page.window, "keyup", { key: "a" }),
  );

  expect(events.map((event) => event.defaultPrevented)).toEqual([false, false, false, false]);
});

test("stopping the scope removes every listener", async () => {
  holdIn();
  send(page.window, "keydown", { key: "a", repeat: false });
  await nextTick();

  scope.stop();
  expect([...page.window.listening.keys()]).toEqual([]);
});
