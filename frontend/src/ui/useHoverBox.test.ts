import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { effectScope, nextTick, shallowRef, type EffectScope } from "vue";

import { useHoverBox, useScrollOutside, type HoverBox } from "./useHoverBox";

class FakeNode extends EventTarget {
  readonly children: FakeNode[] = [];
  left = 0;
  bottom = 0;
  refreshesList = false;
  contains(node: unknown): boolean {
    return node === this || this.children.some((child) => child.contains(node));
  }
  focus(): void {
    page.focused = this;
  }
  closest(selector: string): FakeNode | null {
    return selector === "[data-refreshes-list]" && this.refreshesList ? this : null;
  }
  getBoundingClientRect(): { readonly left: number; readonly bottom: number } {
    return { left: this.left, bottom: this.bottom };
  }
}

class FakeFocusEvent extends Event {
  readonly relatedTarget: EventTarget | null;
  constructor(type: string, relatedTarget: EventTarget | null) {
    super(type);
    this.relatedTarget = relatedTarget;
  }
}

class FakeKeyboardEvent extends Event {
  readonly key: string;
  constructor(key: string) {
    super("keydown", { cancelable: true });
    this.key = key;
  }
}

const page: { focused: unknown; window: EventTarget; document: EventTarget } = {
  focused: null,
  window: new EventTarget(),
  document: new EventTarget(),
};

let scope: EffectScope;
let area: FakeNode;
let opener: FakeNode;
let boxNode: FakeNode;
let item: FakeNode;
let outside: FakeNode;
let openerShown: boolean;
let areaShown: boolean;

beforeEach(() => {
  vi.stubGlobal("Node", FakeNode);
  vi.stubGlobal("HTMLElement", FakeNode);
  vi.stubGlobal("Element", FakeNode);
  vi.stubGlobal("FocusEvent", FakeFocusEvent);
  vi.stubGlobal("KeyboardEvent", FakeKeyboardEvent);
  page.window = new EventTarget();
  vi.stubGlobal("window", page.window);
  page.document = Object.defineProperty(new EventTarget(), "activeElement", {
    get: () => page.focused,
  });
  vi.stubGlobal("document", page.document);
  area = new FakeNode();
  opener = Object.assign(new FakeNode(), { left: 10, bottom: 40 });
  boxNode = new FakeNode();
  item = new FakeNode();
  boxNode.children.push(item);
  area.children.push(opener, boxNode);
  outside = new FakeNode();
  page.focused = outside;
  openerShown = true;
  areaShown = true;
  scope = effectScope();
});

afterEach(() => {
  scope.stop();
  vi.unstubAllGlobals();
});

function asElement(fake: FakeNode): HTMLElement {
  if (fake instanceof HTMLElement) {
    return fake;
  }
  throw new Error("HTMLElement is not the stub");
}

function hoverBox(box: FakeNode | null = null, pinned?: () => boolean): HoverBox {
  const made = scope.run(() =>
    useHoverBox({
      area: () => (areaShown ? asElement(area) : null),
      opener: () => (openerShown ? asElement(opener) : null),
      box: box === null ? null : asElement(box),
      ...(pinned === undefined ? {} : { pinned }),
    }),
  );
  if (made === undefined) {
    throw new Error("scope stopped");
  }
  return made;
}

function focusEvent(type: "focusin" | "focusout", related: FakeNode | null): FocusEvent {
  const event = new FakeFocusEvent(type, related);
  if (event instanceof FocusEvent) {
    return event;
  }
  throw new Error("FocusEvent is not the stub");
}

function key(name: string): KeyboardEvent {
  const event = new FakeKeyboardEvent(name);
  if (event instanceof KeyboardEvent) {
    return event;
  }
  throw new Error("KeyboardEvent is not the stub");
}

function scroll(target: EventTarget): void {
  const event = new Event("scroll");
  Object.defineProperty(event, "target", { value: target });
  page.window.dispatchEvent(event);
}

function press(target: EventTarget): void {
  const event = new Event("pointerdown");
  Object.defineProperty(event, "target", { value: target });
  page.document.dispatchEvent(event);
}

test("the pointer entering opens the box at once below the opener's left edge", () => {
  const box = hoverBox();

  box.on.pointerenter();

  expect(box.open.value).toBe(true);
  expect(box.placement.value).toEqual({ left: "10px", top: "40px" });
});

test("focus entering from outside opens the box", () => {
  const box = hoverBox();

  box.on.focusin(focusEvent("focusin", outside));

  expect(box.open.value).toBe(true);
});

test("without an opener nothing opens", () => {
  openerShown = false;
  const box = hoverBox();

  box.on.pointerenter();

  expect(box.open.value).toBe(false);
});

test("the box stays while focus is inside after the pointer leaves, and closes once both left", () => {
  const box = hoverBox();
  box.on.pointerenter();
  box.on.focusin(focusEvent("focusin", outside));

  box.on.pointerleave();
  expect(box.open.value).toBe(true);
  box.on.focusout(focusEvent("focusout", outside));

  expect(box.open.value).toBe(false);
});

test("the box stays while the pointer is inside after focus leaves, and closes once both left", () => {
  const box = hoverBox();
  box.on.focusin(focusEvent("focusin", null));
  box.on.pointerenter();

  box.on.focusout(focusEvent("focusout", null));
  expect(box.open.value).toBe(true);
  box.on.pointerleave();

  expect(box.open.value).toBe(false);
});

test("focus moving inside the area neither opens nor closes the box", () => {
  const box = hoverBox();
  box.on.focusin(focusEvent("focusin", item));
  expect(box.open.value).toBe(false);

  box.on.focusin(focusEvent("focusin", outside));
  box.on.focusout(focusEvent("focusout", item));

  expect(box.open.value).toBe(true);
});

test("Escape closes the box, takes the key and returns focus to the opener", () => {
  const box = hoverBox();
  const closedEscape = key("Escape");
  box.on.keydown(closedEscape);
  expect(closedEscape.defaultPrevented).toBe(false);
  box.on.pointerenter();
  page.focused = item;

  const enter = key("Enter");
  box.on.keydown(enter);
  expect([box.open.value, enter.defaultPrevented]).toEqual([true, false]);
  const escape = key("Escape");
  box.on.keydown(escape);

  expect([box.open.value, escape.defaultPrevented, page.focused]).toEqual([false, true, opener]);
});

test("an_escape_handled_inside_leaves_the_box_open", () => {
  const box = hoverBox();
  box.on.pointerenter();
  page.focused = item;
  const escape = key("Escape");
  escape.preventDefault();

  box.on.keydown(escape);

  expect([box.open.value, page.focused]).toEqual([true, item]);
});

test("a scroll outside the box closes it; one inside keeps it", () => {
  const box = hoverBox();
  box.on.pointerenter();

  scroll(item);
  expect(box.open.value).toBe(true);
  scroll(outside);

  expect(box.open.value).toBe(false);
});

test("after a scroll closed it with focus in the box, the pointer alone holds it again", () => {
  const box = hoverBox();
  box.on.focusin(focusEvent("focusin", outside));
  page.focused = item;
  box.on.pointerenter();
  scroll(outside);

  box.on.pointerleave();
  box.on.pointerenter();
  box.on.pointerleave();

  expect(box.open.value).toBe(false);
});

test("after a scroll closed it with focus on the opener, that focus still holds it", () => {
  const box = hoverBox();
  box.on.focusin(focusEvent("focusin", outside));
  page.focused = opener;
  box.on.pointerenter();
  scroll(outside);

  box.on.pointerleave();
  box.on.pointerenter();
  box.on.pointerleave();

  expect(box.open.value).toBe(true);
});

test("a scroll while the box is closed leaves the focus held: the pointer leaving keeps it", () => {
  const box = hoverBox();
  box.on.focusin(focusEvent("focusin", outside));
  page.focused = item;
  openerShown = false;
  box.on.keydown(key("Escape"));
  openerShown = true;
  scroll(outside);

  box.on.pointerenter();
  box.on.pointerleave();

  expect(box.open.value).toBe(true);
});

test("close shuts the box and the pointer re-entering opens it again", () => {
  const box = hoverBox();
  box.on.focusin(focusEvent("focusin", outside));
  page.focused = item;

  box.close();
  expect(box.open.value).toBe(false);
  box.on.pointerenter();
  expect(box.open.value).toBe(true);
  box.on.pointerleave();

  expect(box.open.value).toBe(false);
});

test("the pointer alone holds the box: leaving closes it", () => {
  const box = hoverBox();
  box.on.pointerenter();

  box.on.pointerleave();

  expect(box.open.value).toBe(false);
});

test("focus alone holds the box: leaving closes it", () => {
  const box = hoverBox();
  box.on.focusin(focusEvent("focusin", outside));

  box.on.focusout(focusEvent("focusout", outside));

  expect(box.open.value).toBe(false);
});

test("it listens for scrolls anywhere, captured and passive", () => {
  const listen = vi.spyOn(page.window, "addEventListener");

  hoverBox();

  expect(listen.mock.calls.map(([type, , options]) => [type, options])).toEqual([
    ["scroll", { capture: true, passive: true }],
  ]);
});

test("a scroll outside the area is reported, one inside is not, and any is without an area", () => {
  const outsides: string[] = [];
  scope.run(() => {
    useScrollOutside(
      () => (areaShown ? asElement(area) : null),
      () => {
        outsides.push(areaShown ? "with area" : "without area");
      },
    );
  });

  scroll(item);
  scroll(outside);
  areaShown = false;
  scroll(item);

  expect(outsides).toEqual(["with area", "without area"]);
});

test("without an area every focus move counts as one from outside", () => {
  areaShown = false;
  const box = hoverBox();

  box.on.focusin(focusEvent("focusin", item));

  expect(box.open.value).toBe(true);
});

test("Escape after the opener went closes the box and leaves focus alone", () => {
  const box = hoverBox();
  box.on.pointerenter();
  page.focused = item;
  openerShown = false;

  box.on.keydown(key("Escape"));

  expect([box.open.value, page.focused]).toEqual([false, item]);
});

test("keepFocus moves focus in the box to the box, so the box still closes once focus leaves after the control went", () => {
  const box = hoverBox(boxNode);
  box.on.pointerenter();
  page.focused = item;
  box.on.focusin(focusEvent("focusin", outside));

  box.keepFocus();
  boxNode.children.splice(0);
  box.on.pointerleave();
  expect([page.focused, box.open.value]).toEqual([boxNode, true]);
  box.on.focusout(focusEvent("focusout", outside));

  expect(box.open.value).toBe(false);
});

test("keepFocus leaves focus outside the box where it is, the opener included", () => {
  const box = hoverBox(boxNode);
  box.on.pointerenter();

  box.keepFocus();
  expect(page.focused).toBe(outside);
  page.focused = opener;
  box.keepFocus();

  expect(page.focused).toBe(opener);
});

test("keepFocus without a box leaves focus where it is", () => {
  const box = hoverBox();
  page.focused = item;

  box.keepFocus();

  expect(page.focused).toBe(item);
});

test("a_pinned_box_stays_when_the_pointer_and_focus_leave", () => {
  const pin = shallowRef(true);
  const box = hoverBox(boxNode, () => pin.value);
  box.on.pointerenter();
  box.on.focusin(focusEvent("focusin", outside));

  box.on.pointerleave();
  box.on.focusout(focusEvent("focusout", null));
  expect(box.open.value).toBe(true);
  pin.value = false;
  expect(box.open.value).toBe(true);
  box.on.pointerenter();
  box.on.pointerleave();

  expect(box.open.value).toBe(false);
});

test("a_pinned_box_ignores_an_outside_scroll", () => {
  const pin = shallowRef(true);
  const box = hoverBox(boxNode, () => pin.value);
  box.on.pointerenter();

  scroll(outside);
  expect(box.open.value).toBe(true);
  pin.value = false;
  scroll(outside);

  expect(box.open.value).toBe(false);
});

test("a_press_outside_closes_a_pinned_box", async () => {
  const listen = vi.spyOn(page.document, "addEventListener");
  const pin = shallowRef(true);
  const box = hoverBox(boxNode, () => pin.value);
  await nextTick();
  expect(listen).not.toHaveBeenCalled();
  box.on.pointerenter();
  await nextTick();
  expect(listen.mock.calls.map(([type, , options]) => [type, options])).toEqual([
    ["pointerdown", { capture: true }],
  ]);

  press(item);
  press(opener);
  expect(box.open.value).toBe(true);
  press(outside);

  expect(box.open.value).toBe(false);
});

test("a_press_on_a_list_refresh_keeps_a_pinned_box", async () => {
  const refresh = Object.assign(new FakeNode(), { refreshesList: true });
  const box = hoverBox(boxNode, () => true);
  box.on.pointerenter();
  await nextTick();

  press(refresh);
  expect(box.open.value).toBe(true);
  press(outside);

  expect(box.open.value).toBe(false);
});

test("an_unpinned_box_keeps_todays_rule", async () => {
  const listen = vi.spyOn(page.document, "addEventListener");
  const pin = shallowRef(false);
  const box = hoverBox(boxNode, () => pin.value);
  box.on.pointerenter();
  await nextTick();

  press(outside);
  expect([box.open.value, listen.mock.calls.length]).toEqual([true, 0]);
  pin.value = true;
  await nextTick();
  pin.value = false;
  await nextTick();
  press(outside);
  expect(box.open.value).toBe(true);
  scroll(outside);
  expect(box.open.value).toBe(false);
  box.on.pointerenter();
  box.on.pointerleave();

  expect(box.open.value).toBe(false);
});
