import { expect, test } from "vitest";

import { menuPosition } from "./menuPosition";

const MENU = { width: 300, height: 200 };
const VIEWPORT = { width: 1000, height: 800 };

test("a menu that fits opens with its top-left corner at the pointer", () => {
  expect(menuPosition({ pointer: { x: 40, y: 30 }, menu: MENU, viewport: VIEWPORT })).toEqual({
    x: 40,
    y: 30,
  });
});

test("a menu that fits exactly stays at the pointer", () => {
  expect(menuPosition({ pointer: { x: 700, y: 600 }, menu: MENU, viewport: VIEWPORT })).toEqual({
    x: 700,
    y: 600,
  });
});

test("near the right and bottom edges the menu moves left and up just enough", () => {
  expect(menuPosition({ pointer: { x: 990, y: 790 }, menu: MENU, viewport: VIEWPORT })).toEqual({
    x: 700,
    y: 600,
  });
});

test("a menu larger than the window keeps its top-left corner inside it", () => {
  const huge = { width: 1200, height: 900 };

  expect(menuPosition({ pointer: { x: 500, y: 400 }, menu: huge, viewport: VIEWPORT })).toEqual({
    x: 0,
    y: 0,
  });
});
