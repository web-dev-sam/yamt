import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { returnFocus } from "./focusReturn";

class FakeElement {
  focused = false;
  constructor(
    readonly isConnected: boolean,
    readonly visibility: string,
  ) {}
  focus(): void {
    this.focused = true;
  }
}

beforeEach(() => {
  vi.stubGlobal("HTMLElement", FakeElement);
  vi.stubGlobal("getComputedStyle", (element: FakeElement) => ({
    visibility: element.visibility,
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function asElement(fake: FakeElement): HTMLElement {
  if (fake instanceof HTMLElement) {
    return fake;
  }
  throw new Error("HTMLElement is not the stub");
}

test("the keyboard returns to the element focused before when it is still in the page and visible", async () => {
  const before = new FakeElement(true, "visible");
  await returnFocus(asElement(before));
  expect(before.focused).toBe(true);
});

test.each([
  ["no longer in the page", new FakeElement(false, "visible")],
  ["hidden", new FakeElement(true, "hidden")],
])("the keyboard stays where it is when the element focused before is %s", async (_, before) => {
  await returnFocus(asElement(before));
  expect(before.focused).toBe(false);
});

test("with nothing focused before nothing is focused", async () => {
  await expect(returnFocus(null)).resolves.toBeUndefined();
});
