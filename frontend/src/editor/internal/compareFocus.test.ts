import { expect, test } from "vitest";

import { arrowColumn, keyboardColumn } from "./compareFocus";

function column(focused: boolean): Parameters<typeof keyboardColumn>[0]["left"] {
  return { dom: { contains: () => focused }, root: { activeElement: null } };
}

test("the arrows move in the left column when no column has the keyboard", () => {
  const views = { left: column(false), right: column(false) };

  expect(keyboardColumn(views)).toBeNull();
  expect(arrowColumn(views)).toBe("left");
});

test("the arrows move in the column that has the keyboard", () => {
  expect(arrowColumn({ left: column(false), right: column(true) })).toBe("right");
  expect(arrowColumn({ left: column(true), right: column(false) })).toBe("left");
});
