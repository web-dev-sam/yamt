import { expect, test } from "vitest";

import { stepMenuItem } from "./menuKeys";

test("Escape and Tab close a menu", () => {
  expect(stepMenuItem({ count: 3, focused: 1 }, { key: "Escape" })).toEqual({ kind: "close" });
  expect(stepMenuItem({ count: 3, focused: 1 }, { key: "Tab" })).toEqual({ kind: "close" });
});

test("Down and Up move to the next and previous item", () => {
  expect(stepMenuItem({ count: 3, focused: 1 }, { key: "ArrowDown" })).toEqual({
    kind: "focus",
    index: 2,
  });
  expect(stepMenuItem({ count: 3, focused: 1 }, { key: "ArrowUp" })).toEqual({
    kind: "focus",
    index: 0,
  });
});

test("Down on the last item wraps to the first, Up on the first to the last", () => {
  expect(stepMenuItem({ count: 3, focused: 2 }, { key: "ArrowDown" })).toEqual({
    kind: "focus",
    index: 0,
  });
  expect(stepMenuItem({ count: 3, focused: 0 }, { key: "ArrowUp" })).toEqual({
    kind: "focus",
    index: 2,
  });
});

test("rows and pins are one list: Down goes row 1, pin 1, row 2; Up from row 2 to pin 1", () => {
  const rowsAndPins = { count: 4 };
  expect(stepMenuItem({ ...rowsAndPins, focused: 0 }, { key: "ArrowDown" })).toEqual({
    kind: "focus",
    index: 1,
  });
  expect(stepMenuItem({ ...rowsAndPins, focused: 1 }, { key: "ArrowDown" })).toEqual({
    kind: "focus",
    index: 2,
  });
  expect(stepMenuItem({ ...rowsAndPins, focused: 2 }, { key: "ArrowUp" })).toEqual({
    kind: "focus",
    index: 1,
  });
});

test("other keys, and arrows in an empty menu, are left alone", () => {
  expect(stepMenuItem({ count: 3, focused: 0 }, { key: "Enter" })).toEqual({ kind: "ignore" });
  expect(stepMenuItem({ count: 0, focused: -1 }, { key: "ArrowDown" })).toEqual({
    kind: "ignore",
  });
});
