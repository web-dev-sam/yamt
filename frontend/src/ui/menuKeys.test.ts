import { expect, test } from "vitest";

import { MENU_ITEMS, stepMenuItem, wrappedIndex } from "./menuKeys";

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

test("other keys, and arrows in an empty menu, are left alone", () => {
  expect(stepMenuItem({ count: 3, focused: 0 }, { key: "Enter" })).toEqual({ kind: "ignore" });
  expect(stepMenuItem({ count: 0, focused: -1 }, { key: "ArrowDown" })).toEqual({
    kind: "ignore",
  });
});

test("wrappedIndex wraps both ways", () => {
  expect(wrappedIndex(4, 1, 1)).toBe(2);
  expect(wrappedIndex(4, 3, 1)).toBe(0);
  expect(wrappedIndex(4, 2, -1)).toBe(1);
  expect(wrappedIndex(4, 0, -1)).toBe(3);
  expect(wrappedIndex(1, 0, 1)).toBe(0);
});

test("a radio item is stepped: menus step over plain, checkbox and radio items", () => {
  expect(MENU_ITEMS.split(", ")).toEqual([
    "[role=menuitem]",
    "[role=menuitemcheckbox]",
    "[role=menuitemradio]",
  ]);
});
