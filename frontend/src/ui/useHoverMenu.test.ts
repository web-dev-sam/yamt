import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { effectScope, nextTick, type EffectScope } from "vue";

import { HOVER_CLOSE_MS, useHoverMenu, type HoverMenu } from "./useHoverMenu";

vi.hoisted(() => {
  const document = { hasFocus: () => true, createElement: () => ({}) };
  vi.stubGlobal("document", document);
  vi.stubGlobal("window", Object.assign(new EventTarget(), { document }));
});

type Which = "assignee" | "label";

class FakeElement {
  readonly parentElement = null;
  bottom = 100;
  readonly items: FakeElement[] = [];
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

const page: { focused: unknown; body: FakeElement } = { focused: null, body: new FakeElement() };

let scope: EffectScope;
let menu: FakeElement;
let item: FakeElement;
let openers: Readonly<Record<Which, FakeElement>>;
let menuShown: boolean;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("HTMLElement", FakeElement);
  vi.stubGlobal("window", Object.assign(new EventTarget(), { innerHeight: 1000 }));
  vi.stubGlobal("document", {
    body: page.body,
    get activeElement() {
      return page.focused;
    },
  });
  page.focused = page.body;
  menu = new FakeElement();
  item = new FakeElement();
  menu.items.push(item);
  openers = { assignee: new FakeElement(), label: new FakeElement() };
  menuShown = true;
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

function hoverMenu(): HoverMenu<Which> {
  const made = scope.run(() =>
    useHoverMenu<Which>({
      menu: () => (menuShown ? asElement(menu) : null),
      opener: (which) => asElement(openers[which]),
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

async function hoverOpened(which: Which): Promise<HoverMenu<Which>> {
  const hover = hoverMenu();
  hover.pointerEntered(which);
  await settle();
  return hover;
}

test("hover_opens_without_moving_focus", async () => {
  const hover = await hoverOpened("assignee");

  expect(hover.openFor.value).toBe("assignee");
  expect(page.focused).toBe(page.body);
});

test("a hover-opened menu that does not fit below opens above", async () => {
  menu.bottom = 1001;

  const hover = await hoverOpened("assignee");

  expect(hover.above.value).toBe(true);
  menu.bottom = 1000;
  hover.pointerEntered("label");
  await settle();
  expect(hover.above.value).toBe(false);
});

test("moving_to_another_opener_closes_the_first_at_once", async () => {
  const hover = await hoverOpened("assignee");

  hover.pointerLeft();
  hover.pointerEntered("label");
  expect(hover.openFor.value).toBe("label");
  vi.advanceTimersByTime(HOVER_CLOSE_MS);
  await settle();

  expect(hover.openFor.value).toBe("label");
});

test("leaving_closes_after_300_ms_and_re_entering_cancels", async () => {
  const hover = await hoverOpened("assignee");

  hover.pointerLeft();
  vi.advanceTimersByTime(HOVER_CLOSE_MS - 1);
  expect(hover.openFor.value).toBe("assignee");
  hover.pointerEntered("assignee");
  vi.advanceTimersByTime(HOVER_CLOSE_MS);
  expect(hover.openFor.value).toBe("assignee");

  hover.pointerLeft();
  vi.advanceTimersByTime(HOVER_CLOSE_MS);
  expect(hover.openFor.value).toBeNull();
});

test("leaving with focus outside the menu leaves focus there", async () => {
  const row = new FakeElement();
  const hover = await hoverOpened("assignee");
  page.focused = row;

  hover.pointerLeft();
  vi.advanceTimersByTime(HOVER_CLOSE_MS);
  await settle();

  expect(hover.openFor.value).toBeNull();
  expect(page.focused).toBe(row);
});

test("leaving with focus in the menu returns it to the opener", async () => {
  const hover = await hoverOpened("assignee");
  page.focused = item;

  hover.pointerLeft();
  vi.advanceTimersByTime(HOVER_CLOSE_MS);
  await settle();

  expect(hover.openFor.value).toBeNull();
  expect(page.focused).toBe(openers.assignee);
});

test("leaving with no menu open starts nothing", async () => {
  const hover = await hoverOpened("assignee");
  await hover.close();

  hover.pointerLeft();

  expect(vi.getTimerCount()).toBe(0);
});

test("a_click_on_a_hover_opened_opener_pins_it", async () => {
  const hover = await hoverOpened("assignee");

  await hover.openerClicked("assignee");
  expect(page.focused).toBe(item);
  hover.pointerLeft();
  vi.advanceTimersByTime(HOVER_CLOSE_MS);
  await settle();

  expect(hover.openFor.value).toBe("assignee");
});

test("a_second_click_closes", async () => {
  const hover = await hoverOpened("assignee");
  await hover.openerClicked("assignee");

  await hover.openerClicked("assignee");

  expect(hover.openFor.value).toBeNull();
  expect(page.focused).toBe(openers.assignee);
});

test("escape_closes_a_pinned_menu", async () => {
  const hover = await hoverOpened("assignee");
  await hover.openerClicked("assignee");
  vi.stubGlobal("KeyboardEvent", FakeKeyboardEvent);
  const escape = new FakeKeyboardEvent("Escape");
  if (!(escape instanceof KeyboardEvent)) {
    throw new Error("KeyboardEvent is not the stub");
  }

  hover.menuKey(escape);
  await settle();

  expect(hover.openFor.value).toBeNull();
  expect(page.focused).toBe(openers.assignee);
});

test("a click on a closed opener opens with focus inside and hover leaving keeps it", async () => {
  const hover = hoverMenu();

  await hover.openerClicked("label");
  expect([hover.openFor.value, page.focused]).toEqual(["label", item]);
  hover.pointerLeft();
  vi.advanceTimersByTime(HOVER_CLOSE_MS);

  expect(hover.openFor.value).toBe("label");
});

test("a click on another opener while one is hover-open opens the other with focus inside", async () => {
  const hover = await hoverOpened("assignee");

  await hover.openerClicked("label");

  expect([hover.openFor.value, page.focused]).toEqual(["label", item]);
});

test("a click while a hover close is pending cancels it", async () => {
  const hover = await hoverOpened("assignee");
  hover.pointerLeft();

  await hover.openerClicked("label");
  vi.advanceTimersByTime(HOVER_CLOSE_MS);

  expect(hover.openFor.value).toBe("label");
});

test("hovering the open menu's opener again keeps a pinned menu pinned", async () => {
  const hover = await hoverOpened("assignee");
  await hover.openerClicked("assignee");

  hover.pointerEntered("assignee");
  hover.pointerLeft();
  vi.advanceTimersByTime(HOVER_CLOSE_MS);

  expect(hover.openFor.value).toBe("assignee");
});

test("hovering another opener over a pinned menu opens that one by hover", async () => {
  const hover = await hoverOpened("assignee");
  await hover.openerClicked("assignee");

  hover.pointerEntered("label");
  await settle();
  hover.pointerLeft();
  vi.advanceTimersByTime(HOVER_CLOSE_MS);

  expect(hover.openFor.value).toBeNull();
});

test("a menu opened by toggle stays when hover leaves", async () => {
  const hover = hoverMenu();

  await hover.toggle("label");
  hover.pointerLeft();
  vi.advanceTimersByTime(HOVER_CLOSE_MS);

  expect(hover.openFor.value).toBe("label");
});

test("a click on a hover-opened menu without items still pins it", async () => {
  menu.items.length = 0;
  const hover = await hoverOpened("assignee");

  await hover.openerClicked("assignee");
  hover.pointerLeft();
  vi.advanceTimersByTime(HOVER_CLOSE_MS);

  expect([hover.openFor.value, page.focused]).toEqual(["assignee", page.body]);
});

test("a click on a hover-opened menu not drawn yet still pins it", async () => {
  const hover = await hoverOpened("assignee");
  menuShown = false;

  await hover.openerClicked("assignee");
  hover.pointerLeft();
  vi.advanceTimersByTime(HOVER_CLOSE_MS);

  expect([hover.openFor.value, page.focused]).toEqual(["assignee", page.body]);
});

test("a menu that is not drawn opens below and takes no focus", async () => {
  menu.bottom = 1001;
  const hover = await hoverOpened("assignee");
  menuShown = false;

  hover.pointerEntered("label");
  await settle();
  expect([hover.openFor.value, hover.above.value]).toEqual(["label", false]);
  await hover.openerClicked("assignee");

  expect([hover.openFor.value, page.focused]).toEqual(["assignee", page.body]);
});

test("a click opening a menu without items moves no focus", async () => {
  menu.items.length = 0;
  const hover = hoverMenu();

  await hover.openerClicked("label");

  expect([hover.openFor.value, page.focused]).toEqual(["label", page.body]);
});
