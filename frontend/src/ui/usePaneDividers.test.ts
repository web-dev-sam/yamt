import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { effectScope } from "vue";

import type { PaneSplit } from "./paneSplit";
import { dividerHandle, usePaneDividers } from "./usePaneDividers";

class FakeSvg extends EventTarget {
  constructor(readonly parentNode: EventTarget) {
    super();
  }
}

class FakePointerEvent extends Event {
  readonly button = 0;
  readonly pointerId = 1;
  constructor(
    type: string,
    readonly clientX: number,
  ) {
    super(type, { cancelable: true });
  }
}

class FakeElement extends EventTarget {
  readonly setPointerCapture = vi.fn();
}

const WIDTHS = { local: 200, center: 500, remote: 300 };

beforeEach(() => {
  vi.stubGlobal("SVGSVGElement", FakeSvg);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function recorder(): {
  readonly splits: PaneSplit[];
  readonly resets: { count: number };
  readonly split: { setPaneSplit(split: PaneSplit): void; resetPaneSplit(): void };
} {
  const splits: PaneSplit[] = [];
  const resets = { count: 0 };
  return {
    splits,
    resets,
    split: {
      setPaneSplit: (split) => {
        splits.push(split);
      },
      resetPaneSplit: () => {
        resets.count += 1;
      },
    },
  };
}

test("a press on the handle itself or on the strip's svg root is a divider press", () => {
  const handle = new EventTarget();
  const divider = dividerHandle("local", () => WIDTHS, recorder().split);

  expect(divider.accepts({ target: handle, currentTarget: handle })).toBe(true);
  expect(divider.accepts({ target: new FakeSvg(handle), currentTarget: handle })).toBe(true);
});

test("an icon, its nested svg or a wave join keeps its press for the editor", () => {
  const handle = new EventTarget();
  const svg = new FakeSvg(handle);
  const group = new EventTarget();
  const divider = dividerHandle("local", () => WIDTHS, recorder().split);

  expect(divider.accepts({ target: new EventTarget(), currentTarget: handle })).toBe(false);
  expect(divider.accepts({ target: new FakeSvg(group), currentTarget: handle })).toBe(false);
  expect(divider.accepts({ target: new FakeSvg(svg), currentTarget: handle })).toBe(false);
});

test("no handle accepts nothing", () => {
  const divider = dividerHandle("local", () => WIDTHS, recorder().split);

  expect(divider.accepts({ target: null, currentTarget: null })).toBe(false);
});

test("a press measures once and each move sets the dragged split of its boundary", () => {
  const { splits, split } = recorder();
  const measure = vi.fn(() => WIDTHS);

  const local = dividerHandle("local", measure, split).press();
  local?.moveBy(100);
  local?.moveBy(-200);
  const remote = dividerHandle("remote", measure, split).press();
  remote?.moveBy(-100);

  expect(measure).toHaveBeenCalledTimes(2);
  expect(splits).toEqual([
    { local: 0.3, remote: 0.3 },
    { local: 0.22, remote: 0.3 },
    { local: 0.2, remote: 0.4 },
  ]);
});

test("a press that cannot measure gives no drag", () => {
  expect(dividerHandle("local", () => null, recorder().split).press()).toBeNull();
});

test("reset resets the split", () => {
  const { resets, split, splits } = recorder();

  dividerHandle("remote", () => WIDTHS, split).reset();

  expect(resets.count).toBe(1);
  expect(splits).toEqual([]);
});

test("each divider's listeners drag its own boundary", () => {
  vi.stubGlobal("PointerEvent", FakePointerEvent);
  vi.stubGlobal("MouseEvent", FakePointerEvent);
  vi.stubGlobal("Element", FakeElement);
  vi.stubGlobal("document", { documentElement: { classList: { add: vi.fn(), remove: vi.fn() } } });
  const { splits, split } = recorder();
  const scope = effectScope();
  const dividers = scope.run(() => usePaneDividers(() => WIDTHS, split));
  if (dividers === undefined) {
    throw new Error("no scope");
  }

  for (const divider of [dividers.local, dividers.remote]) {
    const element = new FakeElement();
    for (const [type, listener] of Object.entries(divider.listeners)) {
      element.addEventListener(type, listener);
    }
    element.dispatchEvent(new FakePointerEvent("pointerdown", 0));
    element.dispatchEvent(new FakePointerEvent("pointermove", 100));
  }
  scope.stop();

  expect(splits).toEqual([
    { local: 0.3, remote: 0.3 },
    { local: 0.2, remote: 0.22 },
  ]);
});
