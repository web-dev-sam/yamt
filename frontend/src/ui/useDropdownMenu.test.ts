import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { effectScope, nextTick, type EffectScope } from "vue";

import { useDropdownMenu, type DropdownMenu } from "./useDropdownMenu";

const focusTarget = vi.hoisted(() => {
  const document = { hasFocus: () => true, createElement: () => ({}) };
  const window = Object.assign(new EventTarget(), { document });
  vi.stubGlobal("document", document);
  vi.stubGlobal("window", window);
  return window;
});

type Which = "assignee" | "label";

class FakeElement {
  parentElement: FakeElement | null = null;
  overflowY = "visible";
  readonly items: FakeElement[] = [];
  bottom = 0;
  constructor(readonly name: string) {}
  focus(): void {
    page.focused = this;
  }
  contains(node: unknown): boolean {
    return node === this || this.items.some((item) => item === node);
  }
  querySelector(): FakeElement | null {
    return this.items[0] ?? null;
  }
  querySelectorAll(): FakeElement[] {
    return this.items;
  }
  getBoundingClientRect(): { readonly bottom: number } {
    return { bottom: this.bottom };
  }
}

class FakeKeyboardEvent extends Event {
  readonly key: string;
  constructor(key: string) {
    super("keydown", { cancelable: true });
    this.key = key;
  }
}

const VIEWPORT_HEIGHT = 1000;

const page: { focused: unknown; body: FakeElement } = {
  focused: null,
  body: new FakeElement("body"),
};

let scope: EffectScope;
let pageWindow: EventTarget;
let menu: FakeElement;
let item: FakeElement;
let elsewhere: FakeElement;
let openers: Readonly<Record<Which, FakeElement>>;
let drawn: { menu: boolean; opener: boolean };

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("HTMLElement", FakeElement);
  vi.stubGlobal("Element", FakeElement);
  vi.stubGlobal("Node", FakeElement);
  vi.stubGlobal("KeyboardEvent", FakeKeyboardEvent);
  vi.stubGlobal("getComputedStyle", (element: FakeElement) => ({ overflowY: element.overflowY }));
  pageWindow = Object.assign(new EventTarget(), { innerHeight: VIEWPORT_HEIGHT });
  vi.stubGlobal("window", pageWindow);
  vi.stubGlobal("document", {
    body: page.body,
    get activeElement() {
      return page.focused;
    },
  });
  page.focused = page.body;
  menu = new FakeElement("menu");
  item = new FakeElement("item");
  menu.items.push(item);
  elsewhere = new FakeElement("elsewhere");
  openers = { assignee: new FakeElement("assignee"), label: new FakeElement("label") };
  drawn = { menu: true, opener: true };
  scope = effectScope();
});

afterEach(() => {
  scope.stop();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function asElement(fake: FakeElement): HTMLElement {
  if (fake instanceof HTMLElement) {
    return fake;
  }
  throw new Error("HTMLElement is not the stub");
}

function dropdownMenu(): DropdownMenu<Which> {
  const made = scope.run(() =>
    useDropdownMenu<Which>({
      menu: () => (drawn.menu ? asElement(menu) : null),
      opener: (which) => (drawn.opener ? asElement(openers[which]) : null),
    }),
  );
  if (made === undefined) {
    throw new Error("scope stopped");
  }
  return made;
}

async function settle(): Promise<void> {
  await nextTick();
  await nextTick();
  await nextTick();
}

async function opened(how: "open" | "toggle"): Promise<DropdownMenu<Which>> {
  const dropdown = dropdownMenu();
  await dropdown[how]("assignee");
  await settle();
  return dropdown;
}

function aimedAt(type: string, target: FakeElement): Event {
  const event = Object.assign(new Event(type), { detail: 1, composedPath: () => [] });
  Object.defineProperty(event, "target", { value: target });
  return event;
}

async function rightClick(target: FakeElement): Promise<void> {
  pageWindow.dispatchEvent(aimedAt("contextmenu", target));
  await settle();
}

async function click(target: FakeElement): Promise<void> {
  focusTarget.dispatchEvent(aimedAt("pointerdown", target));
  focusTarget.dispatchEvent(aimedAt("click", target));
  vi.runOnlyPendingTimers();
  await settle();
}

async function windowFocus(type: "blur" | "focus"): Promise<void> {
  focusTarget.dispatchEvent(new Event(type));
  await settle();
}

function keyOn(target: FakeElement, name: string): KeyboardEvent {
  const event = new FakeKeyboardEvent(name);
  Object.defineProperty(event, "target", { value: target });
  if (event instanceof KeyboardEvent) {
    return event;
  }
  throw new Error("KeyboardEvent is not the stub");
}

test("dismiss with focus on the page body leaves it there", async () => {
  const dropdown = await opened("open");

  await dropdown.dismiss();

  expect(dropdown.openFor.value).toBeNull();
  expect(page.focused).toBe(page.body);
});

test("dismiss with focus outside the menu leaves it there", async () => {
  const dropdown = await opened("open");
  page.focused = elsewhere;

  await dropdown.dismiss();

  expect(dropdown.openFor.value).toBeNull();
  expect(page.focused).toBe(elsewhere);
});

test("dismiss with focus in the menu returns it to the opener", async () => {
  const dropdown = await opened("open");
  page.focused = item;

  await dropdown.dismiss();

  expect(dropdown.openFor.value).toBeNull();
  expect(page.focused).toBe(openers.assignee);
});

test("dismiss of a menu that is not drawn closes it and moves no focus", async () => {
  const dropdown = await opened("open");
  drawn.menu = false;

  await dropdown.dismiss();

  expect(dropdown.openFor.value).toBeNull();
  expect(page.focused).toBe(page.body);
});

test("closing when the opener is gone moves no focus", async () => {
  const dropdown = await opened("toggle");
  drawn.opener = false;

  await dropdown.close();

  expect(dropdown.openFor.value).toBeNull();
  expect(page.focused).toBe(item);
});

test("closing with nothing open moves no focus", async () => {
  const dropdown = dropdownMenu();

  await dropdown.close();

  expect(dropdown.openFor.value).toBeNull();
  expect(page.focused).toBe(page.body);
});

test("a right click elsewhere with focus on the page body still returns focus to the opener", async () => {
  const dropdown = await opened("toggle");
  page.focused = page.body;

  await rightClick(elsewhere);

  expect(dropdown.openFor.value).toBeNull();
  expect(page.focused).toBe(openers.assignee);
});

test("a right click elsewhere with focus outside the menu leaves it there", async () => {
  const dropdown = await opened("toggle");
  page.focused = elsewhere;

  await rightClick(elsewhere);

  expect(dropdown.openFor.value).toBeNull();
  expect(page.focused).toBe(elsewhere);
});

test("a right click elsewhere with focus in the menu returns it to the opener", async () => {
  const dropdown = await opened("toggle");
  expect(page.focused).toBe(item);

  await rightClick(elsewhere);

  expect(dropdown.openFor.value).toBeNull();
  expect(page.focused).toBe(openers.assignee);
});

test("a right click inside the open menu keeps it open", async () => {
  const dropdown = await opened("toggle");

  await rightClick(item);

  expect(dropdown.openFor.value).toBe("assignee");
});

test("a click elsewhere closes the menu; a click on its opener is left to the opener", async () => {
  const dropdown = await opened("toggle");

  await click(openers.assignee);
  expect(dropdown.openFor.value).toBe("assignee");
  await click(elsewhere);

  expect(dropdown.openFor.value).toBeNull();
  expect(page.focused).toBe(openers.assignee);
});

test("a click with no menu open moves no focus", async () => {
  const dropdown = dropdownMenu();

  await click(elsewhere);

  expect(dropdown.openFor.value).toBeNull();
  expect(page.focused).toBe(page.body);
});

test("window blur closes a toggled menu and returns focus to its opener", async () => {
  const dropdown = await opened("toggle");
  page.focused = page.body;

  await windowFocus("blur");

  expect(dropdown.openFor.value).toBeNull();
  expect(page.focused).toBe(openers.assignee);
});

test("window blur closes a menu opened without focus and leaves focus where it was", async () => {
  const dropdown = await opened("open");
  page.focused = elsewhere;

  await windowFocus("blur");

  expect(dropdown.openFor.value).toBeNull();
  expect(page.focused).toBe(elsewhere);
});

test("window blur with no menu open moves no focus, and focus coming back leaves a new menu open", async () => {
  const dropdown = dropdownMenu();

  await windowFocus("blur");
  expect(page.focused).toBe(page.body);
  await dropdown.toggle("label");
  await windowFocus("focus");

  expect(dropdown.openFor.value).toBe("label");
});

test("a menu opened without focus keeps it; toggling it then moves focus in, toggling again closes", async () => {
  const dropdown = await opened("open");
  expect(dropdown.opened.value).toEqual({ which: "assignee", focus: "kept" });
  expect(page.focused).toBe(page.body);

  await dropdown.toggle("assignee");
  expect(dropdown.opened.value).toEqual({ which: "assignee", focus: "moved" });
  expect(page.focused).toBe(item);

  await dropdown.toggle("assignee");
  expect(dropdown.opened.value).toBeNull();
  expect(page.focused).toBe(openers.assignee);
});

test("a toggled menu closes on a second toggle", async () => {
  const dropdown = await opened("toggle");

  await dropdown.toggle("assignee");

  expect(dropdown.openFor.value).toBeNull();
  expect(page.focused).toBe(openers.assignee);
});

test("toggling another opener while a menu is open switches to it", async () => {
  const dropdown = await opened("toggle");

  await dropdown.toggle("label");

  expect(dropdown.opened.value).toEqual({ which: "label", focus: "moved" });
});

test("a toggled menu that does not fit below opens above", async () => {
  menu.bottom = VIEWPORT_HEIGHT + 1;

  const dropdown = await opened("toggle");

  expect(dropdown.above.value).toBe(true);
});

test("toggling a menu opened without focus moves focus in without placing it again", async () => {
  menu.bottom = VIEWPORT_HEIGHT + 1;
  const dropdown = await opened("open");
  menu.bottom = VIEWPORT_HEIGHT;

  await dropdown.toggle("assignee");

  expect(dropdown.above.value).toBe(true);
});

test("a click elsewhere with focus on the page body closes a menu opened without focus and leaves focus there", async () => {
  const dropdown = await opened("open");

  await click(elsewhere);

  expect(dropdown.openFor.value).toBeNull();
  expect(page.focused).toBe(page.body);
});

test("a right click elsewhere with focus on the page body closes a menu opened without focus and leaves focus there", async () => {
  const dropdown = await opened("open");

  await rightClick(elsewhere);

  expect(dropdown.openFor.value).toBeNull();
  expect(page.focused).toBe(page.body);
});

test("a right click while the open menu is not drawn yet closes it", async () => {
  const dropdown = await opened("open");
  drawn.menu = false;

  await rightClick(elsewhere);

  expect(dropdown.openFor.value).toBeNull();
  expect(page.focused).toBe(page.body);
});

test("a menu that overflows its scrolled box opens above, though the window has room", async () => {
  const wrapper = new FakeElement("wrapper");
  const scroller = new FakeElement("scroller");
  menu.parentElement = wrapper;
  wrapper.parentElement = scroller;
  wrapper.bottom = VIEWPORT_HEIGHT - 300;
  scroller.overflowY = "auto";
  scroller.bottom = VIEWPORT_HEIGHT - 500;
  menu.bottom = VIEWPORT_HEIGHT - 400;

  const dropdown = await opened("toggle");

  expect(dropdown.above.value).toBe(true);
});

test("a menu that fits its scrolled box opens below", async () => {
  const scroller = new FakeElement("scroller");
  menu.parentElement = scroller;
  scroller.overflowY = "auto";
  scroller.bottom = VIEWPORT_HEIGHT - 500;
  menu.bottom = VIEWPORT_HEIGHT - 600;

  const dropdown = await opened("toggle");

  expect(dropdown.above.value).toBe(false);
});

test("arrow keys step through the items, wrapping at both ends, and keep the key from scrolling", async () => {
  const last = new FakeElement("last");
  menu.items.push(last);
  const dropdown = await opened("toggle");
  const down = keyOn(item, "ArrowDown");
  const up = keyOn(item, "ArrowUp");
  const wrap = keyOn(last, "ArrowDown");

  dropdown.menuKey(down);
  expect(page.focused).toBe(last);
  dropdown.menuKey(wrap);
  expect(page.focused).toBe(item);
  dropdown.menuKey(up);

  expect(page.focused).toBe(last);
  expect([down.defaultPrevented, up.defaultPrevented, wrap.defaultPrevented]).toEqual([
    true,
    true,
    true,
  ]);
  expect(dropdown.openFor.value).toBe("assignee");
});

test("Escape closes the menu, returns focus to the opener and is consumed", async () => {
  const dropdown = await opened("toggle");
  const escape = keyOn(item, "Escape");

  dropdown.menuKey(escape);
  await settle();

  expect(escape.defaultPrevented).toBe(true);
  expect(dropdown.openFor.value).toBeNull();
  expect(page.focused).toBe(openers.assignee);
});

test("other keys are left to the page", async () => {
  const dropdown = await opened("toggle");
  const letter = keyOn(item, "a");

  dropdown.menuKey(letter);
  await settle();

  expect(letter.defaultPrevented).toBe(false);
  expect(dropdown.openFor.value).toBe("assignee");
  expect(page.focused).toBe(item);
});

test("an arrow key with no menu drawn is left to the page", async () => {
  const dropdown = await opened("toggle");
  drawn.menu = false;
  const down = keyOn(item, "ArrowDown");

  dropdown.menuKey(down);

  expect(down.defaultPrevented).toBe(false);
  expect(page.focused).toBe(item);
});
