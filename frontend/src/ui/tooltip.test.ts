import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { DirectiveBinding, ObjectDirective, VNode } from "vue";

import { delayBefore, TOOLTIP_DELAY_MS, TOOLTIP_WARM_MS } from "./tooltip";

type Rect = { top: number; bottom: number; left: number; width: number; height: number };

function captures(options: EventListenerOptions | boolean | undefined): boolean {
  return typeof options === "object" ? options.capture === true : options === true;
}

class FakeTarget extends EventTarget {
  readonly listening = new Map<string, string>();
  override addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean,
  ): void {
    const passive = typeof options === "object" && options.passive === true;
    const words = [captures(options) ? "capture" : "", passive ? "passive" : ""];
    this.listening.set(type, words.filter((word) => word !== "").join(" "));
    super.addEventListener(type, callback, options);
  }
  override removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean,
  ): void {
    if (this.listening.get(type)?.startsWith("capture") === captures(options)) {
      this.listening.delete(type);
    }
    super.removeEventListener(type, callback, options);
  }
}

class FakeElement extends FakeTarget {
  className = "";
  hidden = false;
  tagName = "";
  textContent = "";
  readonly style: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  rect: Rect = { top: 0, bottom: 0, left: 0, width: 0, height: 0 };
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }
  getBoundingClientRect(): Rect {
    return this.rect;
  }
}

const TIP_SIZE = { width: 200, height: 30 };

let page: { window: FakeTarget; appended: FakeElement[] };
let hooks: ObjectDirective<HTMLElement, string | null>;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  const appended: FakeElement[] = [];
  const window = Object.assign(new FakeTarget(), { innerWidth: 1600, innerHeight: 1000 });
  vi.stubGlobal("HTMLElement", FakeElement);
  vi.stubGlobal("window", window);
  vi.stubGlobal("document", {
    createElement: (tag: string) => {
      const created = Object.assign(new FakeElement(), { tagName: tag });
      created.rect = { top: 0, bottom: 0, left: 0, ...TIP_SIZE };
      return created;
    },
    body: {
      append: (element: FakeElement) => {
        appended.push(element);
      },
    },
  });
  page = { window, appended };
  const { vTooltip } = await import("./tooltip");
  if (typeof vTooltip === "function") {
    throw new Error("vTooltip is an object directive");
  }
  hooks = vTooltip;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function asElement(fake: FakeElement): HTMLElement {
  if (fake instanceof HTMLElement) {
    return fake;
  }
  throw new Error("HTMLElement is not the stub");
}

function binding(value: string | null): DirectiveBinding<string | null> {
  return { instance: null, value, oldValue: null, modifiers: {}, dir: {} };
}

function vnode(): VNode<HTMLElement, HTMLElement> {
  return Object.create(null);
}

function anchor(text: string | null, rect: Partial<Rect> = {}): FakeElement {
  const fake = new FakeElement();
  fake.rect = { top: 100, bottom: 120, left: 50, width: 80, height: 20, ...rect };
  hooks.mounted?.(asElement(fake), binding(text), vnode(), null);
  return fake;
}

function update(fake: FakeElement, text: string | null): void {
  hooks.updated?.(asElement(fake), binding(text), vnode(), vnode());
}

function unmount(fake: FakeElement): void {
  hooks.beforeUnmount?.(asElement(fake), binding(null), vnode(), null);
}

function send(target: EventTarget, type: string, fields: Record<string, unknown> = {}): Event {
  const event = Object.assign(new Event(type, { cancelable: true }), fields);
  target.dispatchEvent(event);
  return event;
}

function shownText(): string | null {
  const [tip, ...more] = page.appended;
  expect(more).toEqual([]);
  return tip === undefined || tip.hidden ? null : tip.textContent;
}

function showNow(fake: FakeElement): void {
  send(fake, "pointerenter");
  vi.advanceTimersByTime(TOOLTIP_DELAY_MS);
  expect(shownText()).not.toBeNull();
}

test("the_first_tip_waits_400_ms", () => {
  expect(delayBefore(null, 5000)).toBe(TOOLTIP_DELAY_MS);
  expect(delayBefore(null, 100)).toBe(TOOLTIP_DELAY_MS);
  const save = anchor("Save the file");

  send(save, "pointerenter");
  vi.advanceTimersByTime(TOOLTIP_DELAY_MS - 1);
  expect(page.appended).toEqual([]);
  vi.advanceTimersByTime(1);

  expect(shownText()).toBe("Save the file");
});

test("a_tip_within_300_ms_of_the_last_shows_at_once", () => {
  expect(delayBefore(1000, 1000 + TOOLTIP_WARM_MS)).toBe(0);
  const first = anchor("First");
  const second = anchor("Second");
  showNow(first);

  send(first, "pointerleave");
  vi.advanceTimersByTime(TOOLTIP_WARM_MS);
  send(second, "pointerenter");

  expect(shownText()).toBe("Second");
});

test("a_tip_after_the_warm_window_waits_again", () => {
  expect(delayBefore(1000, 1001 + TOOLTIP_WARM_MS)).toBe(TOOLTIP_DELAY_MS);
  const first = anchor("First");
  const second = anchor("Second");
  showNow(first);

  send(first, "pointerleave");
  vi.advanceTimersByTime(TOOLTIP_WARM_MS + 1);
  send(second, "pointerenter");
  expect(shownText()).toBeNull();
  vi.advanceTimersByTime(TOOLTIP_DELAY_MS);

  expect(shownText()).toBe("Second");
});

test("a tip that never showed does not open the warm window", () => {
  const first = anchor("First");
  const second = anchor("Second");

  send(first, "pointerenter");
  vi.advanceTimersByTime(TOOLTIP_DELAY_MS - 1);
  send(first, "pointerleave");
  send(second, "pointerenter");

  expect(shownText()).toBeNull();
});

test("leaving the element hides its tip and cancels a waiting one", () => {
  const save = anchor("Save");
  showNow(save);

  send(save, "pointerleave");
  expect(shownText()).toBeNull();

  vi.advanceTimersByTime(TOOLTIP_WARM_MS + 1);
  send(save, "pointerenter");
  send(save, "pointerleave");
  vi.advanceTimersByTime(TOOLTIP_DELAY_MS);
  expect(shownText()).toBeNull();
});

test("leaving another element leaves the tip alone", () => {
  const save = anchor("Save");
  const other = anchor("Other");
  showNow(save);

  send(other, "pointerleave");

  expect(shownText()).toBe("Save");
});

test("Escape hides the tip without taking the key; other keys keep it", () => {
  const save = anchor("Save");
  showNow(save);

  const enter = send(page.window, "keydown", { key: "Enter" });
  expect(shownText()).toBe("Save");
  const escape = send(page.window, "keydown", { key: "Escape" });

  expect(shownText()).toBeNull();
  expect([enter.defaultPrevented, escape.defaultPrevented]).toEqual([false, false]);
});

test("a scroll anywhere hides the tip", () => {
  showNow(anchor("Save"));

  send(page.window, "scroll");

  expect(shownText()).toBeNull();
});

test("a press anywhere hides the tip and cancels a waiting one", () => {
  const save = anchor("Save");
  showNow(save);

  send(page.window, "pointerdown");
  expect(shownText()).toBeNull();

  vi.advanceTimersByTime(TOOLTIP_WARM_MS + 1);
  send(save, "pointerenter");
  send(page.window, "pointerdown");
  vi.advanceTimersByTime(TOOLTIP_DELAY_MS);
  expect(shownText()).toBeNull();
});

test("the window listeners are captured while a tip waits or shows, and gone once it hides", () => {
  const save = anchor("Save");
  expect(page.window.listening).toEqual(new Map());

  send(save, "pointerenter");
  expect(page.window.listening).toEqual(
    new Map([
      ["pointerdown", "capture passive"],
      ["keydown", "capture"],
      ["scroll", "capture passive"],
    ]),
  );
  vi.advanceTimersByTime(TOOLTIP_DELAY_MS);
  send(save, "pointerleave");

  expect(page.window.listening).toEqual(new Map());
});

test("one tip element, made at the first show, hidden from assistive tech and reused", () => {
  const first = anchor("First\nline two");
  const second = anchor("Second");
  expect(page.appended).toEqual([]);

  showNow(first);
  send(first, "pointerleave");
  send(second, "pointerenter");

  const [tip] = page.appended;
  expect(tip?.tagName).toBe("div");
  expect(tip?.attributes).toEqual(new Map([["aria-hidden", "true"]]));
  expect(tip?.className).toBe(
    "pointer-events-none fixed z-500 w-max overflow-hidden hover-tooltip px-2 py-1 tooltip-text wrap-break-word whitespace-pre-wrap select-none",
  );
  expect(shownText()).toBe("Second");
});

test("the tip sits above its element at the element's left edge, below when it does not fit", () => {
  const high = anchor("High", { top: 100, bottom: 120, left: 50 });
  const low = anchor("Low", { top: 10, bottom: 30, left: 1500 });

  showNow(high);
  const [tip] = page.appended;
  expect(tip?.style).toEqual({ maxWidth: "480px", left: "50px", top: "66px" });
  send(high, "pointerleave");
  send(low, "pointerenter");

  expect(tip?.style).toEqual({ maxWidth: "480px", left: "1400px", top: "34px" });
});

test("the tip is measured once its text is in and its width is limited", () => {
  const save = anchor("Save");
  const widths: string[] = [];
  vi.stubGlobal("document", {
    createElement: () => {
      const created = new FakeElement();
      created.getBoundingClientRect = () => {
        widths.push(`${created.textContent}:${created.style["maxWidth"] ?? "none"}`);
        return { top: 0, bottom: 0, left: 0, ...TIP_SIZE };
      };
      return created;
    },
    body: { append: () => undefined },
  });

  send(save, "pointerenter");
  vi.advanceTimersByTime(TOOLTIP_DELAY_MS);

  expect(widths).toEqual(["Save:480px"]);
});

test("a new value while shown changes the text; null or empty hides it and shows nothing", () => {
  const save = anchor("Save");
  showNow(save);

  update(save, "Saved");
  expect(shownText()).toBe("Saved");
  update(save, null);
  expect(shownText()).toBeNull();

  vi.advanceTimersByTime(TOOLTIP_WARM_MS + 1);
  update(save, "");
  send(save, "pointerenter");
  vi.advanceTimersByTime(TOOLTIP_DELAY_MS);
  expect(shownText()).toBeNull();
});

test("a value cleared while the tip waits shows nothing", () => {
  const save = anchor("Save");

  send(save, "pointerenter");
  update(save, null);
  vi.advanceTimersByTime(TOOLTIP_DELAY_MS);

  expect(shownText()).toBeNull();
  expect(page.window.listening).toEqual(new Map());
});

test("a new value while another element's tip shows leaves that tip alone", () => {
  const save = anchor("Save");
  const other = anchor("Other");
  showNow(save);

  update(other, "Changed");

  expect(shownText()).toBe("Save");
});

test("an element mounted with an empty value shows nothing", () => {
  const empty = anchor("");

  send(empty, "pointerenter");
  expect(page.window.listening).toEqual(new Map());
  vi.advanceTimersByTime(TOOLTIP_DELAY_MS);

  expect(page.appended).toEqual([]);
});

test("entering another element while a tip waits cancels the first", () => {
  const first = anchor("First");
  const second = anchor("Second");
  const half = TOOLTIP_DELAY_MS / 2;

  send(first, "pointerenter");
  vi.advanceTimersByTime(half);
  send(second, "pointerenter");
  vi.advanceTimersByTime(half);
  expect(shownText()).toBeNull();
  vi.advanceTimersByTime(half);

  expect(shownText()).toBe("Second");
});

test("a new value while the tip waits shows at the end of the wait, in its new words", () => {
  const save = anchor("Save");

  send(save, "pointerenter");
  update(save, "Saved");
  expect(shownText()).toBeNull();
  vi.advanceTimersByTime(TOOLTIP_DELAY_MS);

  expect(shownText()).toBe("Saved");
});

test("unmounting the element while its tip shows hides it, and its listeners go", () => {
  const save = anchor("Save");
  showNow(save);

  unmount(save);
  expect(shownText()).toBeNull();
  send(save, "pointerenter");
  vi.advanceTimersByTime(TOOLTIP_DELAY_MS);

  expect(shownText()).toBeNull();
  expect(save.listening).toEqual(new Map());
});

test("unmounting another element leaves the tip alone", () => {
  const save = anchor("Save");
  const other = anchor("Other");
  showNow(save);

  unmount(other);

  expect(shownText()).toBe("Save");
});

test("the text is mirrored into aria-description unless it is the aria-label; never title or aria-label", () => {
  const save = anchor("Save the file");
  expect(save.attributes).toEqual(new Map([["aria-description", "Save the file"]]));

  update(save, "Saved");
  expect(save.attributes).toEqual(new Map([["aria-description", "Saved"]]));
  save.setAttribute("aria-label", "Saved");
  update(save, "Saved");
  expect(save.attributes).toEqual(new Map([["aria-label", "Saved"]]));
  update(save, "Save");
  update(save, null);
  expect(save.attributes).toEqual(new Map([["aria-label", "Saved"]]));
  update(save, "Save");
  unmount(save);
  expect(save.attributes).toEqual(new Map([["aria-label", "Saved"]]));
});

test("an empty value leaves no aria-description", () => {
  expect(anchor("").attributes).toEqual(new Map());
});
