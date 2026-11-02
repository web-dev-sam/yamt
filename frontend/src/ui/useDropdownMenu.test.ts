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
  readonly parentElement = null;
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
