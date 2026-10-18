import { afterEach, expect, test, vi } from "vitest";

import {
  centredScrollTop,
  draggedScrollTop,
  minimapLayout,
  type MinimapInput,
} from "./minimapLayout";
import { MinimapPointer, wheelPixels } from "./minimapPointer";

const TALL: MinimapInput = {
  scrollTop: 72_770,
  viewportHeight: 900,
  paddingTop: 4,
  paddingBottom: 4,
  rows: 7277,
  height: 900,
  pixelRatio: 1,
};
const BOX_TOP = 100;
const WHEEL_MODES = { DOM_DELTA_PIXEL: 0, DOM_DELTA_LINE: 1, DOM_DELTA_PAGE: 2 };

class FakeElement extends EventTarget {
  scrollTop = 0;
  readonly clientHeight = 900;
  readonly scrolled: ScrollToOptions[] = [];
  readonly classes = new Set<string>();
  readonly captured = new Set<number>();
  readonly classList = {
    add: (name: string): void => {
      this.classes.add(name);
    },
    remove: (name: string): void => {
      this.classes.delete(name);
    },
  };
  getBoundingClientRect(): { top: number } {
    return { top: BOX_TOP };
  }
  setPointerCapture(id: number): void {
    this.captured.add(id);
  }
  hasPointerCapture(id: number): boolean {
    return this.captured.has(id);
  }
  releasePointerCapture(id: number): void {
    this.captured.delete(id);
  }
  scrollBy(options: ScrollToOptions): void {
    this.scrolled.push(options);
  }
}

function pointer(
  type: string,
  fields: { button?: number; pointerType?: string; clientY: number },
): Event {
  return Object.assign(new Event(type, { bubbles: true }), {
    button: 0,
    pointerType: "mouse",
    pointerId: 7,
    ...fields,
  });
}

function mounted() {
  const box = new FakeElement();
  const slider = new FakeElement();
  const scroller = new FakeElement();
  const follow = vi.fn();
  const layout = minimapLayout(TALL, null);
  const created = new MinimapPointer({ box, slider, scroller, layout: () => layout, follow });
  return { box, slider, scroller, follow, layout, created };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test("a wheel scrolls by pixels, by lines of 20 px, or by pages of the Result's height", () => {
  vi.stubGlobal("WheelEvent", WHEEL_MODES);

  expect([0, 1, 2].map((mode) => wheelPixels(mode, { clientHeight: 700 }))).toEqual([1, 20, 700]);
});

test("a wheel over the box scrolls the Result by the wheel's pixels and the sides follow", () => {
  vi.stubGlobal("WheelEvent", WHEEL_MODES);
  const { box, scroller, follow } = mounted();

  box.dispatchEvent(Object.assign(new Event("wheel"), { deltaMode: 1, deltaX: 0, deltaY: 3 }));

  expect(scroller.scrolled).toEqual([{ left: 0, top: 60 }]);
  expect(follow).toHaveBeenCalledTimes(1);
});

test("a primary press puts its row's top in the Result's middle and the sides follow", () => {
  const { box, scroller, follow, layout } = mounted();

  box.dispatchEvent(pointer("pointerdown", { clientY: BOX_TOP + 130 }));

  expect(layout.startRow).toBe(3435);
  expect(scroller.scrollTop).toBe(centredScrollTop(3500, TALL));
  expect(follow).toHaveBeenCalledTimes(1);
});

test("a secondary mouse button does nothing; a touch press does", () => {
  const { box, scroller, follow } = mounted();

  box.dispatchEvent(pointer("pointerdown", { button: 2, clientY: BOX_TOP + 130 }));
  expect(scroller.scrollTop).toBe(0);
  box.dispatchEvent(pointer("pointerdown", { button: -1, pointerType: "touch", clientY: BOX_TOP }));
  expect(follow).toHaveBeenCalledTimes(1);
});

test("a slider drag scrolls from where it started and never reaches the box's press", () => {
  const { box, slider, scroller, follow, layout } = mounted();
  const boxPress = vi.fn();
  box.addEventListener("pointerdown", boxPress);
  const press = pointer("pointerdown", { clientY: 500 });

  slider.dispatchEvent(press);
  expect(press.cancelBubble).toBe(true);
  expect(slider.classes.has("active")).toBe(true);
  expect(slider.captured.has(7)).toBe(true);
  slider.dispatchEvent(pointer("pointermove", { clientY: 550 }));
  slider.dispatchEvent(pointer("pointerup", { clientY: 550 }));
  slider.dispatchEvent(pointer("pointermove", { clientY: 600 }));

  expect(scroller.scrollTop).toBe(draggedScrollTop(layout, 50));
  expect(follow).toHaveBeenCalledTimes(1);
  expect(slider.classes.has("active")).toBe(false);
  expect(slider.captured.has(7)).toBe(false);
  expect(boxPress).not.toHaveBeenCalled();
});

test("release mid-drag lets the capture go and ends the drag", () => {
  const { slider, scroller, created } = mounted();

  slider.dispatchEvent(pointer("pointerdown", { clientY: 500 }));
  created.release();
  slider.dispatchEvent(pointer("pointermove", { clientY: 550 }));

  expect(slider.captured.has(7)).toBe(false);
  expect(slider.classes.has("active")).toBe(false);
  expect(scroller.scrollTop).toBe(0);
});

test("a mouse press on the box keeps the focus and the selection where they are", () => {
  const { box } = mounted();
  const press = new Event("mousedown", { bubbles: true, cancelable: true });

  box.dispatchEvent(press);

  expect(press.defaultPrevented).toBe(true);
  expect(press.cancelBubble).toBe(true);
});
